console.log("H E L L O   F R O M   B A C K G R O U N D . J S")

const TIMEOUT_MS = (9*60000); // 9 minutes
const pendingResponses = new Map();
let messageCounter = 0;
let mlWorker = null;

async function ensureWorker() {
  try {
    if (!mlWorker || mlWorker.terminated) {
      console.log("Creating/recreating ML worker");
      mlWorker = new Worker(new URL("./ml-worker.js", import.meta.url));
      
      // Wait for worker to initialise
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Worker initialisation timeout"));
        }, 30000); // 30 second timeout

        mlWorker.onmessage = (event) => {
          if (event.data.type === "initialised") {
            clearTimeout(timeout);
            setupWorkerHandlers();
            resolve();
          }
        };

        mlWorker.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
      
      console.log("ML worker initialised successfully");
    }
  } catch (error) {
    console.error("Failed to initialise worker:", error);
    mlWorker = null;
    throw error;
  }
}



function setupWorkerHandlers() {
  mlWorker.onerror = (error) => {
    console.error("Worker error:", error);
    handleWorkerFailure(error);
  };
  
  mlWorker.onmessage = handleWorkerMessage;
}

function handleWorkerFailure(error) {
  for (const [id, { reject, timeoutId }] of pendingResponses) {
    clearTimeout(timeoutId);
    reject(new Error("Worker crashed: " + error.message));
    pendingResponses.delete(id);
  }
  mlWorker = null;
}

function validateMessage(message) {
  if (!message.elements || typeof message.elements !== "string") {
    throw new Error("Invalid message format: elements must be a string");
  }
  if (message.elements.length > 50000) { // arbitrary character limit
    throw new Error("Text too long to process");
  }
}

function createTask(resolve, reject) {
  const messageId = messageCounter++;
  const timeoutId = setTimeout(() => {
    if (pendingResponses.has(messageId)) {
      console.error("Task timed out:", messageId);
      pendingResponses.get(messageId).reject(new Error("Processing timeout"));
      pendingResponses.delete(messageId);
    }
  }, TIMEOUT_MS);

  pendingResponses.set(messageId, { 
    resolve, 
    reject,
    timeoutId,
    startTime: Date.now()
  });

  return messageId;
}


function handleWorkerMessage(event) {
  if (event.data.type === "initialised") {
    // Handle initialization
    clearTimeout(initTimeout);
    initResolve();
    return;
  }
  
  const { id, error, results } = event.data;
  console.log("Received worker response for ID:", id);
  
  const pending = pendingResponses.get(id);
  if (pending) {
    clearTimeout(pending.timeoutId);
    
    if (error) {
      pending.reject(error);
    } else {
      pending.resolve({ success: true, results });
    }
    pendingResponses.delete(id);
  } else {
    console.warn("Received response for unknown task:", id);
  }
}


function cleanupTimedOutTasks() {
  const now = Date.now();
  for (const [id, { timeoutId, startTime }] of pendingResponses) {
    if (now - startTime > TIMEOUT_MS) {
      clearTimeout(timeoutId);
      pendingResponses.delete(id);
      console.warn("Cleaned up stale task:", id);
    }
  }
}

// Initialise worker
ensureWorker().catch(error => {
  console.error("Initial worker setup failed:", error);
});

// Handle messages from content scripts
browser.runtime.onMessage.addListener((message, sender) => {
  console.log("Received message in background:", message);
  
  if (message.action === "processComments") {
    if (message.elements) {
      return new Promise(async (resolve, reject) => {
        try {
          validateMessage(message);
          
          // Ensure worker is available
          await ensureWorker();
          
          const messageId = createTask(resolve, reject);
          console.log("Created task ID:", messageId);
          
          mlWorker.postMessage({
            id: messageId,
            type: "analyse",
            data: message.elements
          });
          
          console.log("Task sent to worker:", messageId);
          
        } catch (error) {
          console.error("Error processing message:", error);
          reject(error);
        }
      });
    } else {
      return Promise.resolve({ 
        success: false, 
        error: "Expected 'elements' to be present in message" 
      });
    }
  }
  return undefined;
});

// Service worker lifecycle
self.addEventListener("activate", (event) => {
  console.log("Service worker activated");
});

self.addEventListener("install", (event) => {
  console.log("Service worker installed");
});

// Connection handler for all content.js connections
browser.runtime.onConnect.addListener(port => {
  console.log("Content script connected");
  
  // Immediately notify this connection that we're ready
  try {
    port.postMessage({ type: "service-worker-ready" });
  } catch (e) {
    console.log("Couldn't send ready message to port");
  }
  
  port.onMessage.addListener(msg => {
    if (msg.type === "heartbeat") {
      try {
        port.postMessage({ type: "heartbeat-response" });
      } catch (e) {
        console.log("Couldn't send heartbeat response");
      }
    }
  });

  port.onDisconnect.addListener(() => {
    console.log("Content script disconnected");
  });
});

// Function to notify content scripts
async function notifyContentScripts() {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      try {
        if (tab.url && tab.url.startsWith('http')) {
          await browser.tabs.sendMessage(tab.id, { 
            type: "service-worker-ready" 
          }).catch(() => {
            // Silently ignore tabs that don't have our content script
          });
        }
      } catch (e) {
        console.log(`Couldn't notify tab ${tab.id}`);
      }
    }
  } catch (e) {
    console.error("Error notifying tabs:", e);
  }
}

// Periodic maintenance
setInterval(async () => {
  try {
    if (mlWorker) {
      mlWorker.postMessage({ type: "ping" });
    } else {
      await ensureWorker();
    }
    cleanupTimedOutTasks();
  } catch (error) {
    console.error("Maintenance error:", error);
  }
}, 5000);

// Initial notification to content scripts
notifyContentScripts();

// Graceful shutdown
browser.runtime.onSuspend.addListener(() => {
  console.log("Service worker suspending");
  if (mlWorker) {
    mlWorker.terminate();
    mlWorker = null;
  }
  for (const [id, { reject, timeoutId }] of pendingResponses) {
    clearTimeout(timeoutId);
    reject(new Error("Service worker suspending"));
    pendingResponses.delete(id);
  }
});