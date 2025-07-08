import { env, pipeline, cos_sim } from "@huggingface/transformers";
import { lifoQueue } from "./lifoqueue";

// Env setup
env.localModelPath = "/models/";
env.useBrowserCache = false;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.backends.onnx.wasm.wasmPaths = "/wasm/";

let tBedder, tSent;

// Initialise models
async function initModels() {
  tBedder = await pipeline("feature-extraction", "/models/Xenova/bge-base-en-v1.5", { dtype: "fp32" });
  tSent = await pipeline("text-classification", "/models/Xenova/distilbert-base-uncased-finetuned-sst-2-english", { dtype: "fp32" });
}

initModels().then(() => {
  self.postMessage({ type: "initialised" });
}).catch(error => {
  console.error("Failed to initialise models:", error);
  self.postMessage({ error: "Model initialisation failed: " + error.message });
});


async function analyseParagraph(p) {
      return lifoQueue.addTask(async () => {
    try {
      console.log("Processing paragraph:", p);
        // split on clauses
        const clauses = p.split(/<br>|(?=[\.;:,!?\(\)\[\]\{\}…\—\–\-])|(?=\b(and|but|or|nor|for|so|yet|because|although|though|since|unless|until|while|whereas|if|then|however|therefore|moreover|furthermore|consequently|nevertheless|otherwise|meanwhile|alternatively|additionally|finally|subsequently|similarly|instead|thus|hence|accordingly|conversely|as|when|where|which|who|whom|whose|what|whatever|whenever|wherever|whether|why|how|before|after|during|through|throughout|despite|in\s+spite\s+of|rather\s+than|even\s+though|even\s+if|as\s+if|as\s+though|in\s+order\s+to|so\s+that|provided\s+that|assuming\s+that|given\s+that)\s+(I|you|he|she|it|we|they|this|that|these|those|my|your|his|her|its|our|their|the|a|an|any|some|many|much|each|every|all|both|neither|either|one|two|three|four|five|six|seven|eight|nine|ten|most|several|few|little|other|another|such|no|there|here|someone|somebody|something|anyone|anybody|anything|everyone|everybody|everything|no\s+one|nobody|nothing|nowhere|somewhere|everywhere|anywhere|whoever|whatever|whichever|whenever|wherever|however)(\b|\s+|$))/gi)
        .map(s => s ? s.trim() : '')
        .filter(Boolean);

        console.log("Clauses:", clauses);
        // embeddings: shape [n_clauses, hidden] – ready for cosine
        const E = await tBedder(clauses, { pooling: "mean" }); 
        const V = E.tolist();

        // high cosine distance between successive clauses = possible keyword spamming
        const shift = V.slice(1).map((v,i) => 1 - cos_sim(V[i], v));  

        // sentiment labels with over 80% confidence returning true
        const sLabels = (await tSent(clauses)).map(r => r.score >= 0.8);

        // sentiment consistent = rhetorical tone aka getting on soapbox
        return { sentimentStable: new Set(sLabels).size === 1 , shift };
    } catch (error) {
      console.error("Error in analysis:", error);
      throw error;
    }
  });
};

// Add error handling for initialisation
initModels().catch(error => {
  console.error("Failed to initialise models:", error);
  self.postMessage({ error: "Model initialisation failed: " + error.message });
});

self.onmessage = async (e) => {
  console.log('Worker received message:', e.data);
  const { id, type, data } = e.data;
  
  if (type === "analyse") {
    try {
      if (!tBedder || !tSent) {
        throw new Error('Models not initialised');
      }
      
      const results = await analyseParagraph(data);
      console.log('Analysis complete for message:', id);
      
      self.postMessage({ id, results });
    } catch (error) {
      console.error('Error in worker:', error);
      self.postMessage({ 
        id, 
        error: error.message || 'Unknown error in worker'
      });
    }
  }
};
