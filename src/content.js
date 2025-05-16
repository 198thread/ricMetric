
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
  }).join(', ');
  
  // Calculate border width with factor
  const borderWidth = Math.max(1, Math.floor(10 * factor));
  
  // Apply styles to HTML element
  element.style.border = `${borderWidth}px solid transparent`;
  element.style.borderImage = `linear-gradient(to right, ${gradientSteps}) 1`;
  element.style.boxSizing = "border-box";
  
  // Add a subtle background effect
  element.style.position = "relative";
  
  // Create or get the background element
  let bgElement = element.querySelector('.edge-values-bg');
  if (!bgElement) {
    bgElement = document.createElement('div');
    bgElement.className = 'edge-values-bg';
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

  // every comment has a footer of id 'comment-footer-wrapper'
  const commentFooters = document.querySelectorAll("div#comment-footer-wrapper");

  // these are the immediate div siblings with dynamic class names
  const precedingDivs = Array.from(commentFooters).map(footer => 
    footer.previousElementSibling
  ).filter(el => el && el.tagName === 'DIV');

  return precedingDivs;
}



function parse_bbc_comments() {

  console.log("H E L L O   F R O M   P A R S E _ B B C _ C O M M E N T S");

  if (document.location.origin === "https://www.bbc.co.uk" && document.location.pathname.includes("/news/articles/")) {
    // Pull each comment
    const comments = bbc_comment_pull();

    // Extract innerHTML from each comment
    const textComments = comments.map((each) => each.innerHTML);

    for (let [index, eachComment] of textComments.entries()) {
      // Send comments to background script for processing
      browser.runtime.sendMessage({ action: 'processComments', elements: [eachComment] }).then(response => {
        if (response.success) {
          const analysisObj = response.results[0]
          // Note: textComments is an array of strings, not DOM elements
          // You likely want to update the original comments array instead
          edgeValues(comments[index], analysisObj.shift, analysisObj.sentimentStable);
          // console.log(response.results);
          // comments[index].textContent = response.results;
        } else {
          console.error("Error processing comments:", response.error);
        }
      }).catch(error => {
        console.error("Message sending failed:", error);
      });
    }
  }
}


setTimeout(parse_bbc_comments, 5000);