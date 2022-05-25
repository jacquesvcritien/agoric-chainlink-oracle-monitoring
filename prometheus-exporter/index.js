const client = require('prom-client');
const fs = require('fs')
const http = require('http')
const url = require('url')
const request = require('request')
const config = require('./config/general.json')
const sources = require('./config/local-sources.json')
const oracles = require('./config/oracles.json')

const observation_value = new client.Gauge({ name: 'observation_value', help: 'Value submitted by oracle', labelNames: ['oracle', 'address', 'feed'] });
const observation_deviation = new client.Gauge({ name: 'observation_deviation', help: 'Deviation between actual and submitted value', labelNames: ['oracle', 'address', 'feed'] });
const actual_value = new client.Gauge({ name: 'actual_value', help: 'Aggregated value', labelNames: ['feed'] });
const local_prices = new client.Gauge({ name: 'local_prices', help: 'Aggregated value', labelNames: ['feed', 'source'] });

const register = new client.Registry()
register.registerMetric(observation_value)
register.registerMetric(observation_deviation)
register.registerMetric(actual_value)
register.registerMetric(local_prices)

// Define the HTTP server
const server = http.createServer(async (req, res) => {

    // Retrieve route from request object
    const route = url.parse(req.url).pathname

    if (route === '/metrics') {
        // Return all metrics the Prometheus exposition format
        res.setHeader('Content-Type', register.contentType)
        res.end(await register.metrics())
    }
})


async function makePostRequest(url, data){

    const options = {
        url: url,
        body: JSON.stringify(data),
        method: 'POST',        
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    // Return new promise
    return new Promise(function(resolve, reject) {
        // Do async job
        request.post(options, function(err, resp, body) {
            if (err) {
                reject(err.code);
            } else {
                
                //if not 200
                if (resp.statusCode != 200){
                    reject(resp.statusMessage)
                }

                try{
                    resolve(JSON.parse(body).result);
                }
                catch(err){
                    reject(err);
                }
            }
        })
    })
}

// Start the HTTP server which exposes the metrics on http://localhost:8080/metrics
server.listen(8080)

//interval every x seconds
setInterval(async function(){

    for(var file in config.files_to_check){
        console.log("Checking file", config.files_to_check[file])

        var data = fs.readFileSync(config.files_to_check[file], 'utf8');
        data = JSON.parse(data);

        var feed = data["feed"]

        var local_sources_to_check = sources.local_price_checks[feed]
        //for each local source
        for (var index in local_sources_to_check){
            var source = local_sources_to_check[index]

            var data = {
                "id": 1,
                data: source.data
            }
            var result = await makePostRequest(sources.sources[source.source], data)
            local_prices.set({source: source.source, feed: feed}, result)

        }

        for(var key in data){
    
            var oracle_name = oracles.oracle_names[key] ? oracles.oracle_names[key] : ""

            if(key == "actual"){
                actual_value.set({feed: feed}, data[key])
            }
            else if(key != "feed"){
                observation_value.set({address: key, oracle: oracle_name, feed: feed}, data[key])
                var deviation = Math.abs(((data[key] - data["actual"]) / data["actual"]) * 100)
                observation_deviation.set({address: key, oracle: oracle_name, feed: feed}, deviation)
            }
        }
    }
    

}, config.seconds_check * 1000)


  
