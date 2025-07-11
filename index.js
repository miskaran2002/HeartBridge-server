const express = require('express');
const cors = require('cors');
const dotenv =require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');

// load env variables from .env file
dotenv.config();


const app = express();
const port = process.env.PORT || 5000;



// Middlewares
app.use(cors());
app.use(express.json());




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

    //    biodata related api start here
    //    post a bio data
        app.post('/biodatas', async (req, res) => {
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
        app.get('/biodatas', async (req, res) => {
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


        // biodata related api end here


        

        



        
      










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