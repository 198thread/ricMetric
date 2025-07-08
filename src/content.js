console.log("H E L L O   F R O M   C O N T E N T . J S")

// ml-worker connection management
let port;
let mlWorkerPulse = true;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

function setupConnection() {
    if (!mlWorkerPulse) return;
    
    port = browser.runtime.connect({ name: "keepalive" });
    port.onDisconnect.addListener(() => {
        console.log("Port disconnected, reconnecting...");
        if (mlWorkerPulse && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(setupConnection, 1000 * reconnectAttempts);
        }
    });
}

// Initial connection
setupConnection();

// Send periodic heartbeats to keep ml-worker alive
const heartbeatInterval = setInterval(() => {
    if (!mlWorkerPulse) {
        clearInterval(heartbeatInterval);
        return;
    }

    if (port) {
        try {
            port.postMessage({ type: "heartbeat" });
        } catch (e) {
            console.log("Port error, reconnecting...");
            setupConnection();
        }
    }
}, 5000);


function edgeValues(element, values, useColor = true, factor = 0.5) {
  // Generate colors from the values
  const colors = values.map(value => {
    const normalizedValue = Math.max(0, Math.min(1, value));
    
    if (useColor) {
      const hue = Math.floor((normalizedValue * 360 * (values.length)) % 360);
      return `hsl(${hue}, 70%, 50%)`;
    } else {
      const brightness = Math.min(100, Math.floor((normalizedValue * 100) * values.length));
      return `rgb(${brightness}%, ${brightness}%, ${brightness}%)`;
    }
  });

  const gradientSteps = colors.map((color, index) => {
    const percent = (index / (colors.length - 1)) * 100;
    return `${color} ${percent}%`;
  }).join(", ");
  
  const borderWidth = Math.max(1, Math.floor(10 * factor));
  
  element.style.border = `${borderWidth}px solid transparent`;
  element.style.borderImage = `linear-gradient(to right, ${gradientSteps}) 1`;
  element.style.boxSizing = "border-box";
  element.style.position = "relative";
  
  let bgElement = element.querySelector(".edge-values-bg");
  if (!bgElement) {
    bgElement = document.createElement("div");
    bgElement.className = "edge-values-bg";
    bgElement.style.position = "absolute";
    bgElement.style.top = "0";
    bgElement.style.left = "0";
    bgElement.style.right = "0";
    bgElement.style.bottom = "0";
    bgElement.style.zIndex = "-1";
    bgElement.style.opacity = "0.1";
    bgElement.style.pointerEvents = "none";
    
    if (element.firstChild) {
      element.insertBefore(bgElement, element.firstChild);
    } else {
      element.appendChild(bgElement);
    }
  }
  
  bgElement.style.background = `linear-gradient(to right, ${gradientSteps})`;
}

function bbc_comment_pull() {
  const commentFooters = document.querySelectorAll("div#comment-footer-wrapper");
  return Array.from(commentFooters)
    .map(footer => footer.previousElementSibling)
    .filter(el => 
      el && 
      el.tagName === "DIV" && 
      !el.hasAttribute("data-sentiment-processed")
    );
}

function parse_bbc_comments() {
    const comments = bbc_comment_pull();

    if (comments.length === 0) {
        return;
    }

    comments.forEach((commentElement, index) => {
        if (!commentElement.hasAttribute("data-sentiment-processed") && 
            !commentElement.hasAttribute("data-sentiment-failed") &&
            !commentElement.hasAttribute("data-sentiment-processing")) {
            
            startLoadingAnimation(commentElement);
            send_to_bg(commentElement.innerHTML, commentElement, index);
        }
    });
}

function startLoadingAnimation(element) {
  element.style.animation = "none";
  element.offsetHeight; // Force reflow
  
  element.style.border = "4px solid white";
  element.style.animation = "pulseBorder 1.5s infinite";
  
  let style = document.querySelector("#pulseAnimation");
  if (style) {
    document.head.removeChild(style);
  }
  
  style = document.createElement("style");
  style.id = "pulseAnimation";
  style.textContent = `
    @keyframes pulseBorder {
      0% { border-color: white; }
      50% { border-color:rgb(201, 233, 255); }
      100% { border-color: white; }
    }
  `;
  document.head.appendChild(style);
}

function cleanupAnimation(element) {
  if (element) {
    element.style.animation = "none";
    element.style.border = "none";
    element.offsetHeight; // Force reflow
  }
}

async function send_to_bg(commentText, commentElement, index) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    async function attemptSend(retryCount = 0) {
        if (!mlWorkerPulse) {
            throw new Error("Service worker inactive");
        }

        try {
            if (!port) {
                setupConnection();
            }

            const response = await browser.runtime.sendMessage({ 
                action: "processComments", 
                elements: commentText 
            });

            if (response?.success) {
                cleanupAnimation(commentElement);
                const analysisObj = response.results;
                console.log('Analysis results:', analysisObj.shift);
                edgeValues(commentElement, analysisObj.shift, analysisObj.sentimentStable);
                
                commentElement.setAttribute("data-sentiment-processed", "true");
                commentElement.removeAttribute("data-sentiment-processing");
            } else {
                throw new Error(response?.error || "Invalid response");
            }
        } catch (error) {
            if (error.message.includes("Service worker suspending")) {
                mlWorkerPulse = false;
                console.log("Service worker suspended, stopping processing");
                throw error;
            }

            if (error.message.includes("Receiving end does not exist") && retryCount < MAX_RETRIES) {
                console.log(`Connection attempt ${retryCount + 1} failed, retrying in ${RETRY_DELAY}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return attemptSend(retryCount + 1);
            }

            throw error;
        }
    }

    if (!commentElement.hasAttribute("data-sentiment-processed") && 
        !commentElement.hasAttribute("data-sentiment-failed")) {
        commentElement.setAttribute("data-sentiment-processing", "true");
        try {
            await attemptSend();
        } catch (error) {
            console.error("Failed to process comment:", error);
            cleanupAnimation(commentElement);
            commentElement.setAttribute("data-sentiment-failed", "true");
            commentElement.removeAttribute("data-sentiment-processing");
            
            // If service worker is suspended, stop the observer
            if (!mlWorkerPulse) {
                observer.disconnect();
                clearInterval(heartbeatInterval);
            }
        }
    }
}

let observerTimeout;
const observer = new MutationObserver((mutations) => {
    if (!mlWorkerPulse) {
        observer.disconnect();
        return;
    }

    if (observerTimeout) {
        clearTimeout(observerTimeout);
    }
    
    observerTimeout = setTimeout(() => {
        if (!port) {
            setupConnection();
        }
        parse_bbc_comments();
    }, 100);
});


// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
});

// Restart processing if the service worker comes back
browser.runtime.onMessage.addListener((message) => {
    if (message.type === "service-worker-ready") {
        mlWorkerPulse = true;
        reconnectAttempts = 0;
        setupConnection();
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    }
});

// Initial parse
parse_bbc_comments();

// Cleanup on unload
window.addEventListener('unload', () => {
    if (port) {
        port.disconnect();
    }
    observer.disconnect();
});