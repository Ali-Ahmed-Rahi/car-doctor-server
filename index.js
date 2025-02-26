const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Local frontend URL
      "https://car-doctor-e6c18.web.app", // Firebase app URL
      "https://car-doctor-e6c18.firebaseapp.com", // Firebase app URL
    ],
    credentials: true, // Allow sending cookies
  })
);
app.use(express.json());
app.use(cookieParser());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.qorbzds.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Cookie options
const cookieOption = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // Set secure flag for production
  sameSite: process.env.NODE_ENV === "production" ? 'none' : 'strict', // Allow cross-origin cookies in production
};

// Own middleware for logging
const logger = (req, res, next) => {
  console.log("called", req.host, req.originalUrl);
  next();
};

// JWT Verification Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access - No token" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized - Invalid token" });
    }
    req.user = decoded;
    next();
  });
};

// Routes
async function run() {
  try {
    await client.connect();

    // Service Collection (MongoDB)
    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");

    // JWT Authentication Route
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "24h", // Token expires in 24 hours
      });
      res.cookie("token", token, cookieOption).send({ success: true });
    });

    // Logout Route (Clears the token cookie)
    app.post("/logout", (req, res) => {
      res.clearCookie("token", { ...cookieOption, maxAge: 0 }).send({ success: true });
    });

    // Get all services
    app.get("/services", async (req, res) => {
      const services = await serviceCollection.find().toArray();
      res.send(services);
    });

    // Get a specific service by ID
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

    // Create a booking
    app.post("/bookings", logger, async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // Get bookings for a specific user (Email-based)
    app.get("/bookings/:email", logger, verifyToken, async (req, res) => {
      if (req.user.email !== req.params.email) {
        return res.status(403).send({ message: "Forbidden access - Unauthorized email" });
      }
      const email = req.params.email;
      const query = { email: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // Delete a booking by ID
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Update booking status by ID
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateBooking = req.body;
      const updateDoc = {
        $set: {
          status: updateBooking.status,
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Confirm MongoDB connection
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);

// Basic route
app.get("/", (req, res) => {
  res.send("Car Doctor is running");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
