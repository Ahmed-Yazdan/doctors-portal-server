const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Setting up firebase admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// require("./doctors-portal-firebase-adminsdk.json")
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// MiddleWare
app.use(cors());
app.use(express.json());


//*********** DATABASE **************** */

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0v9zw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// FIREBASE FUNCTION TO VERIFY ADMIN
const verifyToken = async (req, res, next) => {
    if (req.headers.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
};

const runDatabase = async () => {
    try {
        await client.connect();
        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');

        // GET ALL APPOINTMENTS WITH EMAIL AND DATE
        app.get('/appointments', verifyToken, async (req, res) => {
            const { email } = req.query;
            const date = req.query.date;
            const query = { email: email, date: date };
            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        });

        // SENDING A SINGLE APPOINTMENT TO DATABASE
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment)
            res.json(result);
        });

        // SENDING USER INFO TO DATABASE
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.json(result);
        });

        // UPDATING USER
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        // MAKING A USER ADMIN
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requestSender = req.decodedEmail;
            if (requestSender) {
                const requestSenderAccount = await usersCollection.findOne({ email: requestSender });
                if (requestSenderAccount.role === 'admin') {
                    const filter = { email: user.email }
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc)
                    res.json(result);
                };
            }
            else{
                res.status(403).json({message: 'You do not have access to make admin'});
            };
        });

        //VERIFYING WHETHER THE USER IS ADMIN OR NOT
        app.get('/users/:email', async (req, res) => {
            let isAdmin = false;
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role === 'admin') {
                isAdmin = true;
            };
            res.json({ admin: isAdmin });
        })


    } finally {
        // DO nothing
    }
}

runDatabase().catch(console.dir);





// *********** NODE SERVER ************ //

app.get("/", (req, res) => {
    res.send("doctors portal server is running");
})
app.listen(port, () => {
    console.log('Running on port', port)
});

