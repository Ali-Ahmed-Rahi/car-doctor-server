const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const app = express();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      // "http://localhost:5173",
      "https://car-doctor-e6c18.web.app",
      "https://car-doctor-e6c18.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.qorbzds.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized token" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");

    // jwt route
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "24h",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: false, 
        sameSite: 'strict', // change to 'lax' or 'strict' if needed
      });

      res.send({ success: true }); // 🔴 ERROR FIXED HERE: removed second res.send
    });

    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: false,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.get("/services", async (req, res) => {
      const services = await serviceCollection.find().toArray();
      res.send(services);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: {
          title: 1,
          price: 1,
          service_id: 1,
          img: 1,
          description: 1,
          facility: 1,
        },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.user.email !== req.params.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const updateBooking = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: updateBooking.status,
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
  } catch (error) {
    console.error(error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Car Doctor is running");
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
