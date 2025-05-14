const comments = [
    "Are you really sure about this?",
    "I love turtles",
    "elephants are known to be scrimpy"
];

browser.runtime.sendMessage({ action: 'processComments', comments });

browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'processedResults') {
    console.log('Processed embeddings:', msg.data);
    // You’ll handle the DOM update here later
  }
});