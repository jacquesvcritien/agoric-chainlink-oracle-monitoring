//IMPORTS
import { E } from '@agoric/far';
import { AmountMath } from '@agoric/ertp';
import { deeplyFulfilled } from '@endo/marshal';
import '@agoric/zoe/exported.js';
import '@agoric/zoe/src/contracts/exported.js';
import * as fs from 'fs';

var results = {}

//Function to monitor oracles' observations
export default async function monitor(homePromise) {
    const {
        SECONDS,
        ASSET_IN,
        ASSET_OUT,
    } = process.env;

    const INSTANCE = ASSET_IN+"-"+ASSET_OUT+" priceAggregator"

    // Let's wait for the promise to resolve.
    const home = await deeplyFulfilled(homePromise);
    var instance = await E(home.agoricNames).lookup('instance', INSTANCE)
    var pf = await E(home.zoe).getPublicFacet(instance)
    var roundNotifier = await E(pf).getRoundCompleteNotifier()

    //set feed
    results["feed"] = ASSET_IN+"-"+ASSET_OUT;
    
    var updateCount;
    
    while(true){

        const result = await E(roundNotifier).getUpdateSince(updateCount)
        updateCount = result.updateCount;

        //get aggregated value
        results["actual"] = (Number(result.value.authenticatedQuote.quoteAmount.value[0].amountOut.value)*1.0) / Number(result.value.authenticatedQuote.quoteAmount.value[0].amountIn.value)

        var observations = result.value.submitted
    
        //for each observation
        for(var i=0; i<observations.length; i++){
            var obs = observations[i]
            var submitter = obs[0]
            var value = (Number(obs[1].numerator.value)*1.0) / Number(obs[1].denominator.value)
            results[submitter] = Number(value)
        }
        console.log("Results", results)

        var filename = ASSET_IN+"-"+ASSET_OUT+".json"
    
        await fs.writeFileSync(filename, JSON.stringify(results), 'utf8')
//         await new Promise(r => setTimeout(r, SECONDS * 1000));
    }
}
