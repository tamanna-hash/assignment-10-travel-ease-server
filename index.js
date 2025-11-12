const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config()
const admin = require("firebase-admin");

const app = express()
const port = process.env.PORT || 3000;
app.use(cors())
app.use(express.json())

const serviceAccount = require("./serviceKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.dgujpdx.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        res.status(401).send({
            message: 'Unauthorized Access'
        })
    }
    const token = authorization.split(" ")[1];

    try {
        await admin.auth().verifyIdToken(token)
        next()
    } catch (error) {
        res.status(401).send({
            message: 'Unauthorized Access'
        })
    }
}
async function run() {
    try {
        await client.connect();

        const db = client.db('vehicleDB')
        const vehicleCollection = db.collection('vehicles')
        const requestRideCollection = db.collection('requestRides')
        // find
        app.get('/all-vehicles', async (req, res) => {
            // const result = await vehicleCollection.find().toArray()
            const sort = req.query.sort;
            let cursor = vehicleCollection.find();

            if (sort === 'asc') cursor = cursor.sort({ pricePerDay: 1 });
            if (sort === 'desc') cursor = cursor.sort({ pricePerDay: -1 });

            const result = await cursor.toArray();
            res.send(result)
        })
        // find one
        app.get('/all-vehicles/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const objectId = { _id: new ObjectId(id) }
            const result = await vehicleCollection.findOne(objectId)

            res.send(result)
        })
        // find with email
        app.get('/my-vehicles', verifyToken, async (req, res) => {
            const email = req.query.email;
            const result = await vehicleCollection.find({ userEmail: email }).toArray()
            res.send(result)
        })
        app.post('/all-vehicles', verifyToken, async (req, res) => {
            const data = req.body
            const result = await vehicleCollection.insertOne(data)
            res.send(result)
        })
        app.get('/my-bookings', verifyToken, async (req, res) => {
            const email = req.query.email
            const result = await requestRideCollection.find({ bookingBy: email }).toArray()
            res.send(result)
        })
        // booking-details
        app.get('/all-bookings/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const objectId = { _id: new ObjectId(id) }
            const result = await requestRideCollection.findOne(objectId)
            res.send(result)
        })
        app.post('/my-bookings/:id', async (req, res) => {
            const data = req.body;
            const id = req.params.id
            const result = await requestRideCollection.insertOne(data)

            //booking counted 
            const filter = { _id: new ObjectId(id) }
            const update = {
                $inc: {
                    booked: 1
                }
            }
            const requestCounted = await vehicleCollection.updateOne(filter, update)
            res.send(result)


        })
        // latest-6
        app.get('/latest-vehicles', async (req, res) => {
            const result = await vehicleCollection.find().sort({ createdAt: "desc" }).limit(6).toArray()
            res.send(result)
        })
        // top rated vehicles
        app.get('/top-vehicles', async (req, res) => {
            const result = await vehicleCollection.find().sort({ rating: "desc" }).limit(3).toArray()
            res.send(result)
        })
        app.get('/search', async (req, res) => {
            const search_text = req.query.search;
            let result;
            if (!search_text || search_text.trim() === "") {
                result = await vehicleCollection.find().toArray();
            } else {
                result = await vehicleCollection.find({
                    vehicleName: { $regex: search_text, $options: 'i' }
                }).toArray();
            }
            res.send(result)
        })
        // update

        app.put('/all-vehicles/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) }
            const update = {
                $set: data
            }
            const result = await vehicleCollection.updateOne(filter, update)

            res.send(result)
        })
        // delete

        app.delete('/all-vehicles/:id', verifyToken, (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = vehicleCollection.deleteOne(filter)
            res.send(result)
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