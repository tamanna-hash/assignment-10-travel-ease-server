const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const serviceAccount = require("./serviceKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.dgujpdx.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    res.status(401).send({
      message: "Unauthorized Access",
    });
  }
  const token = authorization.split(" ")[1];

  try {
    await admin.auth().verifyIdToken(token);
    next();
  } catch (error) {
    res.status(401).send({
      message: "Unauthorized Access",
    });
  }
};
async function run() {
  try {
    // await client.connect();

    const db = client.db("vehicleDB");
    const vehicleCollection = db.collection("vehicles");
    const requestRideCollection = db.collection("requestRides");
    // find
    app.get("/all-vehicles", async (req, res) => {
      try {
        const {
          sort,
          category,
          rating,
          search,
          page = 1,
          limit = 8,
        } = req.query;

        const query = {};

        if (category) {
          query.category = category;
        }

        if (rating) {
          query.rating = { $gte: Number(rating) };
        }

        if (search) {
          query.vehicleName = { $regex: search, $options: "i" };
        }

        let cursor = vehicleCollection.find(query);

        if (sort === "asc" || sort === "desc") {
          cursor = cursor.sort({ pricePerDay: sort === "asc" ? 1 : -1 });
        }

        const skip = (Number(page) - 1) * Number(limit);

        const vehicles = await cursor.skip(skip).limit(Number(limit)).toArray();
        const total = await vehicleCollection.countDocuments(query);
        const totalPages = Math.ceil(total / Number(limit)); // calculate total pages

        res.send({
          success: true,
          total,
          totalPages, // <-- add this
          page: Number(page),
          vehicles,
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch vehicles" });
      }
    });

    // find one
    app.get("/all-vehicles/:id", async (req, res) => {
      const id = req.params.id;
      const objectId = { _id: new ObjectId(id) };
      const result = await vehicleCollection.findOne(objectId);
      res.send(result);
    });
    // find with email
    app.get("/my-vehicles", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await vehicleCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });
    app.post("/all-vehicles", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await vehicleCollection.insertOne(data);
      res.send(result);
    });
    app.get("/my-bookings", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await requestRideCollection
        .find({ bookingBy: email })
        .toArray();
      res.send(result);
    });
    // check if booked by user already
    app.get("/my-bookings/check", verifyToken, async (req, res) => {
      const { email, vehicleId } = req.query;

      const booking = await requestRideCollection.findOne({
        bookingBy: email,
        vehicleId: vehicleId,
      });
      console.log(booking);
      res.send({ isBooked: !!booking });
    });
    // booking-details
    app.get("/all-bookings/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const objectId = { _id: new ObjectId(id) };
      const result = await requestRideCollection.findOne(objectId);
      res.send(result);
    });
    app.post("/my-bookings/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const result = await requestRideCollection.insertOne(data);

      //booking counted
      const filter = { _id: new ObjectId(id) };
      const update = {
        $inc: {
          booked: 1,
        },
        //     $set: {
        //     availability:'Booked'
        // }
      };
      const requestCounted = await vehicleCollection.updateOne(filter, update);
      res.send({ result, requestCounted });
    });
    // latest-6
    app.get("/latest-vehicles", async (req, res) => {
      const result = await vehicleCollection
        .find()
        .sort({ createdAt: "desc" })
        .limit(6)
        .toArray();
      res.send(result);
    });
    // top rated vehicles
    app.get("/top-vehicles", async (req, res) => {
      const result = await vehicleCollection
        .find()
        .sort({ rating: "desc" })
        .limit(4)
        .toArray();
      res.send(result);
    });
    app.get("/search", async (req, res) => {
      const search_text = req.query.search;
      let result;
      if (!search_text || search_text.trim() === "") {
        result = await vehicleCollection.find().toArray();
      } else {
        result = await vehicleCollection
          .find({
            vehicleName: { $regex: search_text, $options: "i" },
          })
          .toArray();
      }
      res.send(result);
    });
    // update

    app.put("/all-vehicles/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: data,
      };
      const result = await vehicleCollection.updateOne(filter, update);

      res.send(result);
    });
    // delete

    app.delete("/all-vehicles/:id", verifyToken, (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = vehicleCollection.deleteOne(filter);
      res.send(result);
    });
    // charts......
    // GET /dashboard-stats?email=user@example.com
    app.get("/dashboard-stats", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (!email)
          return res
            .status(400)
            .send({ success: false, message: "Email is required" });

        const vehicles = await vehicleCollection
          .find({ userEmail: email })
          .toArray();

        const totalVehicles = vehicles.length;

        // Revenue estimation: pricePerDay * assumed 1 booked per vehicle
        const totalRevenue = vehicles.reduce(
          (acc, v) => acc + (v.pricePerDay || 0),
          0
        );

        const categoryCounts = vehicles.reduce((acc, v) => {
          acc[v.category] = (acc[v.category] || 0) + 1;
          return acc;
        }, {});

        // Price distribution for Bar Chart
        const priceRanges = [
          { name: "0-100", min: 0, max: 100, count: 0 },
          { name: "101-200", min: 101, max: 200, count: 0 },
          { name: "201-300", min: 201, max: 300, count: 0 },
          { name: "301-400", min: 301, max: 400, count: 0 },
          { name: "400+", min: 401, max: Infinity, count: 0 },
        ];
        vehicles.forEach((v) => {
          const range = priceRanges.find(
            (r) => v.pricePerDay >= r.min && v.pricePerDay <= r.max
          );
          if (range) range.count += 1;
        });

        res.send({
          success: true,
          stats: {
            totalVehicles,
            totalRevenue,
            categoryCounts,
            priceDistribution: priceRanges.map((r) => ({
              name: r.name,
              count: r.count,
            })),
          },
        });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });
   
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});
app.listen(port, (req, res) => {
  console.log(`server is running on port${port}`);
});
