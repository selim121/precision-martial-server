const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 4000;


//middleware
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }
    //bearer token
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d18ofon.mongodb.net/?retryWrites=true&w=majority`;

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
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection

        const usersCollection = client.db("precisionMartial").collection("users");
        const classesCollection = client.db("precisionMartial").collection("classes");
        const enrolledClassesCollection = client.db("precisionMartial").collection("enrolledClasses");


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })


        //user-details
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.get('/allUsers', async (req, res) => {
            const result = await usersCollection.find({}).toArray();
            res.send(result);
        })

        app.get('/allUsers/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result);
        })
        app.get('/allUsers/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            res.send(result);
        })

        app.patch('/allUsers/admin/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const filter = { _id: new ObjectId(id) };
                const updateDoc = { $set: { role: 'admin' } };
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                res.status(400).send({ error: true, message: 'Invalid ID' });
            }
        });


        app.get('/allUsers/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' };
            res.send(result);
        })

        app.patch('/allUsers/instructor/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const filter = { _id: new ObjectId(id) };
                const updateDoc = { $set: { role: 'instructor' } };
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                res.status(400).send({ error: true, message: 'Invalid ID' });
            }
        });


        app.delete('/allUsers/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        //classes
        app.post('/classes', async (req, res) => {
            const addClass = req.body;
            const result = await classesCollection.insertOne(addClass);
            res.send(result);
        })
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find({}).toArray();
            res.send(result);
        })
        app.get('/classes/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        app.patch('/classes/approved/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'approved'
                }
            }
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        app.patch('/classes/deny/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'deny'
                }
            }
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })


        app.put('/classes/:id/feedback', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const feedback = req.body.feedback;
            const updateDoc = {
                $set: {
                    feedback: feedback
                }
            };

            const result = await classesCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        app.put('/classes/update/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateClass = req.body;
            const updateDoc = {
                $set: {
                    name: updateClass.name,
                    email: updateClass.email,
                    className: updateClass.className,
                    price: updateClass.price,
                    seats: updateClass.seats,
                    photo: updateClass.photo,
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        app.get('/allInstructors', async (req, res) => {
            try {
                const users = await usersCollection.find({ role: 'instructor' }).toArray();
                res.json(users);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'An error occurred while fetching instructors' });
            }
        });
        app.get('/approved-classes', async (req, res) => {
            try {
                const classes = await classesCollection.find({ status: 'approved' }).toArray();
                res.json(classes);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'An error occurred while fetching instructors' });
            }
        });

        app.get('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCollection.findOne(query);
            res.send(result);
        })

        app.post('/enrolledClasses', async (req, res) => {
            const enrolledClass = req.body;
            const result = await enrolledClassesCollection.insertOne(enrolledClass);
            res.send(result);
        })

        app.get('/enrolledClasses/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await enrolledClassesCollection.find(query).toArray();
            res.send(result);
        })

        app.delete('/enrolledClasses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await enrolledClassesCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/payment/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await enrolledClassesCollection.findOne(query);
            res.send(result);
        })

        //create payment
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card'],
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Precision Martial is running...');
});

app.listen(port, () => {
    console.log(`Precision Martial is running on port ${port}`);
})