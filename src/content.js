console.log("H E L L O   F R O M   C O N T E N T . J S")

function edgeValues(element, values, useColor = true, factor = 0.5) {
  // Generate colors from the values
  const colors = values.map(value => {
    if (useColor) {
      // Color version - use HSL
      const hue = Math.floor((value * 360 * (values.length)) % 360);
      return `hsl(${hue}, 70%, 50%)`;
    } else {
      // Grayscale version - convert to brightness value
      const brightness = Math.floor((value * 100) * values.length);
      return `rgb(${brightness}%, ${brightness}%, ${brightness}%)`;
    }
  });
  
  // Create a linear gradient string
  const gradientSteps = colors.map((color, index) => {
    const percent = (index / (colors.length - 1)) * 100;
    return `${color} ${percent}%`;
  }).join(", ");
  
  // Calculate border width with factor
  const borderWidth = Math.max(1, Math.floor(10 * factor));
  
  // Apply styles to HTML element
  element.style.border = `${borderWidth}px solid transparent`;
  element.style.borderImage = `linear-gradient(to right, ${gradientSteps}) 1`;
  element.style.boxSizing = "border-box";
  
  // Add a subtle background effect
  element.style.position = "relative";
  
  // Create or get the background element
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
    
    // Insert as first child
    if (element.firstChild) {
      element.insertBefore(bgElement, element.firstChild);
    } else {
      element.appendChild(bgElement);
    }
  }
  
  // Apply gradient to background
  bgElement.style.background = `linear-gradient(to right, ${gradientSteps})`;
  
}


function bbc_comment_pull() {
  // every comment has a footer of id "comment-footer-wrapper"
  const commentFooters = document.querySelectorAll("div#comment-footer-wrapper");

  // these are the immediate div siblings with dynamic class names
  const precedingDivs = Array.from(commentFooters).map(footer => 
    footer.previousElementSibling
  ).filter(el => el && el.tagName === "DIV").filter(comment => !comment.hasAttribute("data-sentiment-processed"));

  return precedingDivs;
}


function parse_bbc_comments() {

  const comments = bbc_comment_pull();

  if (comments.length === 0) {
    // console.log("No comments found")
    return;
  }
  const textComments = comments.map((each) => each.innerHTML);

  for (let [index, eachComment] of textComments.entries()) {
    const commentElement = comments.find(elem => elem.innerHTML === eachComment);
    if (commentElement) {
      console.log("sending");
      startLoadingAnimation(commentElement);
      send_to_bg(eachComment, commentElement, index);
    }
  }
}

function startLoadingAnimation(element) {
  // First stop any existing animations
  element.style.animation = "none";
  element.offsetHeight;
  
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

function send_to_bg(commentText, commentElement, index) {
  browser.runtime.sendMessage({ 
    action: "processComments", 
    elements: commentText 
  }).then(response => {
    if (response.success) {
      // Stop animation and remove border
      commentElement.style.animation = "none";
      commentElement.style.border = "none";
      commentElement.offsetHeight;
      
      const analysisObj = response.results;
      console.log(analysisObj);
      edgeValues(commentElement, analysisObj.shift, analysisObj.sentimentStable);
      
      // Mark as processed
      commentElement.setAttribute("data-sentiment-processed", "true");
    } else {
      console.error("Error processing comments:", response.error);
      cleanupAnimation(commentElement);
    }
  }).catch(error => {
    console.error("Message sending failed:", error);
    cleanupAnimation(commentElement);
  });
}

function cleanupAnimation(element) {
  element.style.animation = "none";
  element.style.border = "none";
  element.offsetHeight;
}





// Create a mutation observer
const observer = new MutationObserver((mutations) => {
    parse_bbc_comments();
});

// Start observing the document with the configured parameters
observer.observe(document.body, {
    childList: true,
    subtree: true
});
