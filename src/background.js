import { env, pipeline } from '@huggingface/transformers';

// Specify a custom location for models (defaults to '/models/').
env.localModelPath = '/models/';

// Disable caching attempts for extension URLs
env.useBrowserCache = false;

// Disable the loading of remote models from the Hugging Face Hub:
env.allowRemoteModels = false;
env.allowLocalModels = true;

// Set location of .wasm files to your extension's directory
env.backends.onnx.wasm.wasmPaths = '/wasm/';


async function testLoad() {
  try { 

    // More detailed loading process with step logging
    console.log("Initializing pipeline with feature-extraction task...");
    const featureSpotter = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", {
      dtype: 'fp32'
    })
    
    console.log("Model loaded successfully! Testing with sample text...");
    
    const testTexts = [
      "I have eaten the plums that were in the icebox",
      "which you were probably saving for breakfast.",
      "Forgive me",
      "they were delicious so sweet and so cold"
    ]
    
    const embeddings = await featureSpotter(testTexts,
      { pooling: 'mean', normalize: true }
    );
    
    console.log("Inference successful!");
    console.log(embeddings);
    console.log(embeddings.tolist());

    return embeddings;
  } catch (error) {
    console.error("Error loading or running model:", error);
    
    throw error;
  }
}

// Execute the test and log results
testLoad()
  .then(result => {
    console.log("Test completed successfully!");
  })
  .catch(error => {
    console.error("Test failed with error:", error.message);
  });
