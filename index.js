const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config()
const app = express()
const port = process.env.PORT || 3000;
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.dgujpdx.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const db = client.db('vehicleDB')
        const vehicleCollection = db.collection('vehicles')
        // find
        app.get('/all-vehicles', async (req, res) => {
            const result = await vehicleCollection.find().toArray()
            res.send(result)
        })
        // find one
        app.get('/all-vehicles/:id', async (req, res) => {
            const id = req.params.id
            const objectId = { _id: new ObjectId(id) }
            const result = await vehicleCollection.findOne(objectId)

            res.send(result)
        })
        app.post('/all-vehicles', async (req, res) => {
            const data = req.body
            console.log(data);
            const result = await vehicleCollection.insertOne(data)
            res.send({
                success: true,
                result
            })
        })
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {

    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('server is running')
})
app.listen(port, (req, res) => {
    console.log(`server is running on port${port}`)
})