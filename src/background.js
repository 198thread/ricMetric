import { env, pipeline, cos_sim, mean, std_mean, Tensor } from '@huggingface/transformers';

// Specify a custom location for models (defaults to '/models/').
env.localModelPath = '/models/';

// Disable caching attempts for extension URLs
env.useBrowserCache = false;

// Disable the loading of remote models from the Hugging Face Hub:
env.allowRemoteModels = false;
env.allowLocalModels = true;

// Set location of .wasm files to your extension's directory
env.backends.onnx.wasm.wasmPaths = '/wasm/';

// Load model
const tBedder = await pipeline("feature-extraction", "Xenova/bge-base-en-v1.5", { dtype: 'fp32'});
const tSent = await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {dtype: 'fp32'});
// ---------------------------------------------------------------------------------- //
//                                                                                    // 
//                         END OF BACKGROUND LOADING PROCEDURE                        //
//                                                                                    // 
// ---------------------------------------------------------------------------------- //


// --- analyse one paragraph -----------------------------------------------
async function analyseParagraph(p) {
  const clauses = p.split(/<br>|[\.,;!?-]/g).map(s => s.trim()).filter(Boolean);

  // embeddings: shape [n_clauses, hidden] – ready for cosine
  const E = await tBedder(clauses, { pooling: 'cls'}); 
  const V = E.tolist();

  // cosine distance between successive clauses
  const shift = V.slice(1).map((v,i) => 1 - cos_sim(V[i], v));  
 // high ⇒ topic jump

  // sentiment labels with over 80% confidence returning true
  const sLabels = (await tSent(clauses)).map(r => r.score >= 0.8);

  return {sentimentStable: new Set(sLabels).size === 1 , shift};
}


browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'processComments') {
    if (message.elements && Array.isArray(message.elements)) {
      // For Firefox, we need to return a Promise
      return Promise.all(message.elements.map(element => analyseParagraph(element)))
        .then(results => {
          return { success: true, results: results };
        })
        .catch(error => {
          console.error("Error processing comments:", error);
          return { success: false, error: error.message };
        });
    } else {
      return Promise.resolve({ 
        success: false, 
        error: "Expected 'elements' to be an array of comment strings" 
      });
    }
  }
  
  // Return undefined for unhandled messages
  return undefined;
});


console.log("H E L L O   F R O M   B A C K G R O U N D . J S")
