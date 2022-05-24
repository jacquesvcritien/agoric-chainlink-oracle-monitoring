const client = require('prom-client');
const fs = require('fs')
const http = require('http')
const url = require('url')
const config = require('./config.json')

const observation_value = new client.Gauge({ name: 'observation_value', help: 'Value submitted by oracle', labelNames: ['oracle', 'feed'] });
const observation_deviation = new client.Gauge({ name: 'observation_deviation', help: 'Deviation between actual and submitted value', labelNames: ['oracle', 'feed'] });
const actual_value = new client.Gauge({ name: 'actual_value', help: 'Aggregated value', labelNames: ['feed'] });

const register = new client.Registry()
register.registerMetric(observation_value)
register.registerMetric(observation_deviation)
register.registerMetric(actual_value)

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

// Start the HTTP server which exposes the metrics on http://localhost:8080/metrics
server.listen(8080)

//interval every x seconds
setInterval(async function(){

    for(var file in config.files_to_check){
        console.log("Checking file", config.files_to_check[file])

        var data = fs.readFileSync(config.files_to_check[file], 'utf8');
        data = JSON.parse(data);
    
        for(var key in data){
            if(key == "actual"){
                actual_value.set({feed: data["feed"]}, data[key])
            }
            else if(key != "feed"){
                observation_value.set({oracle: key, feed: data["feed"]}, data[key])
                var deviation = Math.abs(((data[key] - data["actual"]) / data["actual"]) * 100)
                observation_deviation.set({oracle: key, feed: data["feed"]}, deviation)
            }
        }
    }
    

}, config.seconds_check * 1000)


  
