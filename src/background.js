import { env, pipeline, cos_sim } from "@huggingface/transformers";
import { lifoQueue } from "./lifoqueue"; // WARN: Singleton

// Specify a custom location for models (defaults to '/models/').
env.localModelPath = "/models/";

// Disable caching attempts for extension URLs
env.useBrowserCache = false;

// Disable the loading of remote models from the Hugging Face Hub:
env.allowRemoteModels = false;
env.allowLocalModels = true;

// Set location of .wasm files to your extension's directory
env.backends.onnx.wasm.wasmPaths = "/wasm/";

// Load model
const tBedder = await pipeline("feature-extraction", "Xenova/bge-base-en-v1.5", { pooling: "mean", dtype: "f32" });
const tSent = await pipeline("text-classification", "Xenova/distilbert-base-uncased-finetuned-sst-2-english", { dtype: "f32" });


// ---------------------------------------------------------------------------------- //
//                                                                                    // 
//                         END OF BACKGROUND LOADING PROCEDURE                        //
//                                                                                    // 
// ---------------------------------------------------------------------------------- //





// TODO: Move to own func
    // TODO: See if needed
    // TODO: if synthetic, keyword positions would be mirrored by LLM's accent, clause-to-clause
    // try {
    //   await keywordPositionValuation(clauses)
    //     .then(kPV => {
    //       // console.log(kPV);
    //     })
    //     .catch(error => {
    //       console.log(error);
    //     });
    // } catch (error) {
    //   console.log(error);





async function analyseParagraph(p) {
  // Trying to find keyword spamming + rhetorical tone
  return lifoQueue.addTask(async () => {

    // split on clauses
    const clauses = p.split(/<br>|(?=[\.;:,!?\(\)\[\]\{\}…\—\–\-])|(?=\b(and|but|or|nor|for|so|yet|because|although|though|since|unless|until|while|whereas|if|then|however|therefore|moreover|furthermore|consequently|nevertheless|otherwise|meanwhile|alternatively|additionally|finally|subsequently|similarly|instead|thus|hence|accordingly|conversely|as|when|where|which|who|whom|whose|what|whatever|whenever|wherever|whether|why|how|before|after|during|through|throughout|despite|in\s+spite\s+of|rather\s+than|even\s+though|even\s+if|as\s+if|as\s+though|in\s+order\s+to|so\s+that|provided\s+that|assuming\s+that|given\s+that)\s+(I|you|he|she|it|we|they|this|that|these|those|my|your|his|her|its|our|their|the|a|an|any|some|many|much|each|every|all|both|neither|either|one|two|three|four|five|six|seven|eight|nine|ten|most|several|few|little|other|another|such|no|there|here|someone|somebody|something|anyone|anybody|anything|everyone|everybody|everything|no\s+one|nobody|nothing|nowhere|somewhere|everywhere|anywhere|whoever|whatever|whichever|whenever|wherever|however)(\b|\s+|$))/gi)
    .map(s => s ? s.trim() : '')
    .filter(Boolean);

    // embeddings: shape [n_clauses, hidden] – ready for cosine
    const E = await tBedder(clauses); 
    const V = E.tolist();

    // cosine distance between successive clauses
    // high = topic jump 
    // irrational discussion / keyword spamming
    const shift = V.slice(1).map((v,i) => 1 - cos_sim(V[i], v));  

    // sentiment labels with over 80% confidence returning true
    const sLabels = (await tSent(clauses)).map(r => r.score >= 0.8);

    // sentiment stable = matched to model/rhetorical tone
    // fist pounding / angry Hank Hill shouting over garden fence
    return { sentimentStable: new Set(sLabels).size === 1 , shift };
  });
};


browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "processComments") {
    if (message.elements) {
      // For Firefox, we need to return a Promise
      return Promise.resolve(analyseParagraph(message.elements))
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
