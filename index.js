const express = require('express');
const cors = require('cors');
const dotenv =require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');
const admin = require("firebase-admin");

// load env variables from .env file
dotenv.config();
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);




const app = express();
const port = process.env.PORT || 5000;



// Middlewares
app.use(cors());
app.use(express.json());


 const serviceAccount = require('./firebase-admin-key.json');

 admin.initializeApp({
     credential: admin.credential.cert(serviceAccount)
 });

//  console.log(admin.auth().verifyIdToken);





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bbgsyar.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;




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
        await client.connect();

        const db = client.db("bioDataDB");
        const bioDataCollection = db.collection("bioData");
        const contactRequestsCollection = db.collection("contactRequests");
        const favouritesCollection = db.collection("favourites");
        const usersCollection = db.collection("users");

        // custom middleware
        const verifyFBToken =async (req, res, next) => {
            console.log('header in middleware',req.headers.authorization);
             const authHeader = req.headers.authorization;
             if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
            }
            const token = authHeader.split(' ')[1];
             if (!token) {
                 return res.status(401).send({ message: 'Unauthorized access' });
             }
           // verify token
            try {
              const decoded = await admin.auth().verifyIdToken(token);
              req.decoded = decoded;
               next();

               
           }
           catch (error) {
                console.log(error);
               return res.status(403).send({ message: 'Forbidden access' });
               
           }


           

            
         }
     
        










        // users related api start here
        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                const existingUser = await usersCollection.findOne({ email: user.email });

                if (existingUser) {
                    return res.send({ message: 'User already exists', inserted: false });
                }

                user.role = 'user';
                user.isPremium = false;

                const result = await usersCollection.insertOne(user);
                res.send({ message: 'User created', inserted: true, id: result.insertedId });
            } catch (err) {
                console.error('User create error:', err);
                res.status(500).send({ message: 'Server error' });
            }
        });


    //    biodata related api start here
    //    post a bio data
        app.post('/biodatas',verifyFBToken, async (req, res) => {
            try {
                const newBio = req.body;

                if (!newBio?.email) {
                    return res.status(400).send({ success: false, message: 'Email is required' });
                }

                // Step 1: Check if a biodata already exists for this user (by email)
                const existingBiodata = await bioDataCollection.findOne({ email: newBio.email });

                if (existingBiodata) {
                    // Update the existing biodata
                    const updateResult = await bioDataCollection.updateOne(
                        { email: newBio.email },
                        {
                            $set: {
                                ...newBio,
                                updatedAt: new Date()
                            }
                        }
                    );

                    return res.send({
                        success: true,
                        message: 'Biodata updated successfully!',
                        modifiedCount: updateResult.modifiedCount
                    });
                }

                // Step 2: Generate a new biodataId (if not exists)
                const lastBiodata = await bioDataCollection
                    .find({})
                    .sort({ biodataId: -1 })
                    .limit(1)
                    .toArray();

                const lastId = lastBiodata.length > 0 ? lastBiodata[0].biodataId : 0;
                newBio.biodataId = lastId + 1;

                // Step 3: Set flags
                newBio.isPremium = false;
                newBio.createdAt = new Date();

                // Step 4: Insert the new biodata
                const insertResult = await bioDataCollection.insertOne(newBio);

                res.status(201).send({
                    success: true,
                    message: 'Biodata created successfully!',
                    insertedId: insertResult.insertedId,
                    biodataId: newBio.biodataId
                });

            } catch (error) {
                console.error('❌ Biodata POST error:', error.message);
                res.status(500).send({
                    success: false,
                    message: 'Internal server error',
                });
            }
        });


        // get all biodata
        app.get('/biodatas',  async (req, res) => {
            try {
                const biodatas = await bioDataCollection
                    .find({})
                    .sort({ biodataId: 1 }) // ascending order by ID, change to -1 for descending
                    .toArray();

                res.send({
                    success: true,
                    count: biodatas.length,
                    data: biodatas
                });
            } catch (error) {
                console.error('❌ Error fetching biodatas:', error.message);
                res.status(500).send({
                    success: false,
                    message: 'Failed to fetch biodatas',
                });
            }
        });



        // GET: /biodata/:email — Get biodata by user email
        app.get('/biodata/:email', async (req, res) => {
            try {
                const email = req.params.email;

                if (!email) {
                    return res.status(400).send({
                        success: false,
                        message: 'Email parameter is required',
                    });
                }

                const biodata = await bioDataCollection.findOne({ email });

                if (!biodata) {
                    return res.status(404).send({
                        success: false,
                        message: 'No biodata found for this email',
                    });
                }

                res.send({
                    success: true,
                    data: biodata,
                });

            } catch (error) {
                console.error('❌ Error fetching biodata by email:', error.message);
                res.status(500).send({
                    success: false,
                    message: 'Internal server error',
                });
            }
        });


        app.put('/biodata/:email', async (req, res) => {
            try {
                const email = req.params.email;
                const updatedData = req.body;

                if (!email || !updatedData) {
                    return res.status(400).send({
                        success: false,
                        message: 'Email and updated data are required',
                    });
                }

                // ✅ Remove _id field if it exists
                if (updatedData._id) {
                    delete updatedData._id;
                }

                const updateResult = await bioDataCollection.updateOne(
                    { email },
                    {
                        $set: {
                            ...updatedData,
                            updatedAt: new Date()
                        }
                    }
                );

                if (updateResult.matchedCount === 0) {
                    return res.status(404).send({
                        success: false,
                        message: 'No biodata found to update for this email',
                    });
                }

                res.send({
                    success: true,
                    message: 'Biodata updated successfully',
                    modifiedCount: updateResult.modifiedCount
                });

            } catch (error) {
                console.error('❌ Error updating biodata:', error.message);
                res.status(500).send({
                    success: false,
                    message: 'Internal server error',
                });
            }
        });



        // ✅ GET: Get single biodata by biodataId
        app.get('/biodata/by-id/:biodataId', async (req, res) => {
            try {
                const biodataId = parseInt(req.params.biodataId);

                const biodata = await bioDataCollection.findOne({ biodataId });

                if (!biodata) {
                    return res.status(404).send({
                        success: false,
                        message: 'No biodata found with this ID',
                    });
                }

                // Optional: ensure biodataId is a number (in case MongoDB returns $numberInt)
                const sanitized = {
                    ...biodata,
                    biodataId: Number(biodata.biodataId),
                    _id: biodata._id.toString(), // Optional: stringify Mongo _id
                };

                res.send({
                    success: true,
                    data: sanitized,
                });
            } catch (error) {
                console.error('❌ Error fetching biodata by ID:', error.message);
                res.status(500).send({
                    success: false,
                    message: 'Internal server error',
                });
            }
        });



        // biodata related api end here

        //  contact request related api start here
  
        // POST: /contact-requests
        app.post('/contact-requests',  async (req, res) => {
            try {
                const request = req.body;

                request.status = 'pending';           // default status
                request.createdAt = new Date();       // optional timestamp

                const result = await contactRequestsCollection.insertOne(request);

                res.send({ success: true, insertedId: result.insertedId });
            } catch (err) {
                console.error('❌ Error saving contact request:', err);
                res.status(500).send({ error: err.message });
            }
        });

        // GET: /contact-requests?email=user@example.com
        app.get('/contact-requests', verifyFBToken, async (req, res) => {
            const userEmail = req.query.email;
            if (!userEmail) return res.status(400).send({ error: 'Missing email' });

            const result = await contactRequestsCollection
                .find({ email: userEmail })
                .toArray();

            res.send(result);
        });
        

       
        // delete contact request
        app.delete('/contact-requests/:id', async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ success: false, message: 'Invalid ID' });
                }

                const result = await contactRequestsCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount > 0) {
                    res.send({ success: true, deletedCount: result.deletedCount });
                } else {
                    res.status(404).send({ success: false, message: 'Request not found' });
                }
            } catch (err) {
                console.error('❌ Error deleting contact request:', err);
                res.status(500).send({ success: false, message: err.message });
            }
        });






        app.post('/create-payment-intent',verifyFBToken, async (req, res) => {
            try {
                const { email } = req.body;

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: 500, // $5 in cents
                    currency: 'usd',
                    metadata: { email }, // optional: to track the user
                });

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (err) {
                console.error('Error creating PaymentIntent:', err);
                res.status(500).send({ error: err.message });
            }
        });


        // contact request related api end



        // favourite related api start
        app.post('/favourites', async (req, res) => {
            const { userEmail, biodataId, name, occupation, permanentDivision } = req.body;

            if (!userEmail || !biodataId) {
                return res.status(400).send({ message: 'Missing userEmail or biodataId' });
            }

            const alreadyExists = await favouritesCollection.findOne({ userEmail, biodataId });

            if (alreadyExists) {
                return res.status(409).send({ message: 'Already in favourites' });
            }

            const favouriteDoc = {
                userEmail,
                biodataId,
                name,
                occupation,
                permanentDivision,
                addedAt: new Date(),
            };

            const result = await favouritesCollection.insertOne(favouriteDoc);
            res.send(result);
        });


        app.get('/favourites', verifyFBToken,  async (req, res) => {
           const email = req.query.email;
            if (!email) {
                return res.status(400).send({ message: 'Email is required' });
            }

            const favourites = await favouritesCollection.find({ userEmail: email }).toArray();
            res.send(favourites);
        });

       
        // delete an id
        app.delete('/favourites/:id', async (req, res) => {
            const id = req.params.id;
            const result = await favouritesCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });


        // favourite related api end






        

        



        
      










        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);














// sample route
app.get('/', (req, res) => {
    res.send('heartBridge Server is running');
})

// start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})