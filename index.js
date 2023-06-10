const express = require('express');
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

// Middleware part

app.use(express.json());
app.use(cors());

// JWT verification

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access JWT' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access not Admin' })
        }
        req.decoded = decoded;
        next();
    })
}

// MongoDB initialization part

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xothnon.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const database = client.db("WayOfTheDragonDB");

//   All APIs
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();

        const usersCollection = database.collection("users");
        const classesCollection = database.collection("classes");

        // Admin verification & JWT

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        const verifyStudent = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'student') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

            res.send({ token })
        })

        // user APIs

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email };

            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'This user already exists in the database.' })
            }

            const result = await usersCollection.insertOne(user);

            res.send(result);
        })

        // Admin parts

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        // Instructor parts

        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        // Student parts

        app.get('/users/student/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ student: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { student: user?.role === 'student' }
            res.send(result);
        })

        app.patch('/users/student/:email', async (req, res) => {
            const email = req.params.email;
            // console.log(id);
            // console.log(email);
            const filter = { email: email };
            const updateDoc = {
                $set: {
                    role: 'student'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.patch('/users/student/select/:email', async (req, res) => {
            const email = req.params.email;
            const { id } = req.body;

            // console.log(id);

            const filter = { email: email };

            const prevResult = await usersCollection.findOne(filter);

            const classes = prevResult.selectedClasses;

            let matchingClass = false;

            if (classes)
                matchingClass = classes.includes(id);

            // console.log(matchingClass);

            if (matchingClass) {
                return res.send({ error: true, message: "This class has already been selected" })
            }

            const updateDoc = {
                $push: { selectedClasses: id }
            };

            const result = await usersCollection.updateOne(filter, updateDoc, { upsert: true });

            res.send(result);
        })

        app.patch('/users/student/select/delete/:email', async (req, res) => {
            const email = req.params.email;
            const { id } = req.body;
            const query = { email: email };
            const result = await usersCollection.updateOne(query, { $pull: { selectedClasses: id } });
            res.send(result);
        })


        app.get('/users/student/select/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await usersCollection.findOne(filter);
            res.send(result.selectedClasses);
        })


        // classes APIs

        app.get('/classes', async (req, res) => {
            const query = { status: "approved" };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/classes/all/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const result = await classesCollection.findOne(filter);
            res.send(result);
        })

        app.patch('/classes/update/:id', async (req, res) => {
            const id = req.params.id;
            const newName = req.body.name;
            const newImage = req.body.image;
            const newTotalSeats = req.body.totalSeats;
            const newPrice = req.body.price;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    name: newName,
                    image: newImage,
                    totalSeats: newTotalSeats,
                    price: newPrice
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.post('/classes', async (req, res) => {
            const item = req.body;

            const result = await classesCollection.insertOne(item);

            res.send(result);
        })

        app.get('/classes/instructor/all/:email', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.params.email;
            const filter = { instructorEmail: email };
            const result = await classesCollection.find(filter).toArray();
            res.send(result);
        })

        app.get('/classes/all', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        app.patch('/classes/approve/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'approved'
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.patch('/classes/deny/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'denied'
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.patch('/classes/feedback/:id', async (req, res) => {
            const id = req.params.id;
            const sentFeedback = req.body.feedback;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    feedback: sentFeedback
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.get('/classes/popular', async (req, res) => {
            const query = { status: "approved" };
            const sort = { enrolledStudents: -1 };
            const result = await classesCollection.find(query).sort(sort).collation({ locale: "en_US", numericOrdering: true }).limit(6).toArray();
            res.send(result);
        })

        // Stripe part NEEDS Fixing

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.post('/payments', verifyJWT, async (req, res) => {
            const { id, email } = req.body;
            const query = { email: email };
            console.log(email);

            const findResult = await usersCollection.findOne(query);

            const deleteDoc = {
                $pull: { selectedClasses: id }
            }

            const deleteResult = await usersCollection.updateOne(query, deleteDoc);


            if (findResult.enrolledClasses.includes(id)) {
                return res.send({ error: true, message: "This class has already been selected" })
            }

            const insertDoc = {
                $push: { enrolledClasses: id }
            }

            const updateDoc = {
                $inc: { enrolledStudents: 1 }
            }

            const updateResult = await classesCollection.updateOne({ _id: new Object(id) }, updateDoc, { upsert: false })

            console.log(updateResult)

            const insertResult = await usersCollection.updateOne(query, insertDoc, { upsert: true });

            console.log(insertResult);

            res.send({ deleteResult, insertResult });
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})