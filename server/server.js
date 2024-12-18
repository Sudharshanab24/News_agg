require("dotenv").config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const express=require("express");
const axios = require("axios");
const cors = require("cors");
const path=require("path");

const app = express();

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  imgUrl: { type: String },
  description: { type: String },
  url: { type: String },
  source: { type: String },
  author: { type: String },
  publishedAt: { type: Date },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to User
});

const Article = mongoose.model('Article', articleSchema);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


// Body-parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client/dist')));


async function makeApiRequest(url) {
  try {
    const response = await axios.get(url);
    return {
      status: 200,
      success: true,
      message: "Successfully fetched the data",
      data: response.data,
    };
  } catch (error) {
    console.error("API request error:", error.response ? error.response.data : error.message);
    return {
      status: 500,
      success: false,
      message: "Failed to fetch data from the API",
      error: error.response ? error.response.data : error.message,
    };
  }
}


// Error-handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);  // Respond OK to OPTIONS preflight without authentication
  }
  next();
});


mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });

  const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
  });
  
const User = mongoose.model('User', userSchema);

const API_KEY=process.env.API_KEY;

function fetchNews(url,res)
{
    axios.get(url)
    .then(response=>{
        if(response.data.totalResults>0){
            res.json({
                status:200,
                success:true,
                message:"Success",
                data:response.data
            });
        }
        else{
            res.json({
                status:200,
                success:true,
                message:"No results"
            });
        }
    })
    .catch(error=>{
        res.json({
            status:500,
            success:false,
            message:"failed",
            error:error.message
        });
    });
}

app.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, name });
    await user.save();
    res.status(201).send({ message: 'User registered' });
  });

  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).send('User not found');
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send('Invalid credentials');
    }
  
    // Include the email in the token payload
    const token = jwt.sign({ id: user._id, email: user.email }, 'your_jwt_secret', { expiresIn: '1h' });
    
    res.send({ token, name: user.name });
  });

  app.get('/api/search', async (req, res) => {
    const { q, page, pageSize } = req.query;
    
    try {
      const response = await fetch(`https://newsapi.org/v2/everything?q=${q}&page=${page}&pageSize=${pageSize}&apiKey=${process.env.API_KEY}`);
      const data = await response.json();
  
      if (data.status === 'ok') {
        res.json(data); // Send the data back to the client
      } else {
        res.status(500).json({ message: 'Failed to fetch search results.' });
      }
    } catch (error) {
      console.error("Error fetching search results:", error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });

  app.get('/news', async (req, res) => {
    const { country } = req.query;
    const apiKey = 'YOUR_NEWS_API_KEY';  // Replace with your actual News API key

    try {
        const response = await axios.get(`https://newsapi.org/v2/everything?q=${country}&apiKey=${process.env.API_KEY}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});
  
  app.get('/profile', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send('Access denied. No token provided.');
    }
  
    const token = authHeader.split(' ')[1];
    try {
      const verified = jwt.verify(token, 'your_jwt_secret');
      const user = await User.findById(verified.id);
  
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      const articles = await Article.find({ userId: user._id });
      res.send({ email: user.email, name: user.name, articles });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(400).send('Invalid token or server error');
    }
  });
  

  
  

app.get("/all-news", async (req, res) => {
  const pageSize = parseInt(req.query.pageSize) || 80;
  const page = parseInt(req.query.page) || 1;
  const query = req.query.q || 'world';

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}&apiKey=${process.env.API_KEY}`;
  const result = await makeApiRequest(url);
  res.status(result.status).json(result);
});


app.get("/api/top-headlines", async (req, res) => {
  const pageSize = parseInt(req.query.pageSize) || 80;
  const page = parseInt(req.query.page) || 1;
  const category = req.query.category || "general";

  const url = `https://newsapi.org/v2/top-headlines?category=${category}&language=en&page=${page}&pageSize=${pageSize}&apiKey=${process.env.API_KEY}`;
  const result = await makeApiRequest(url);
  res.status(result.status).json(result);
});

app.post('/save-article', async (req, res) => {
  const authHeader = req.headers['authorization'];
  
  // Ensure the token is in the "Bearer <token>" format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Access denied. No token provided.');
  }

  const token = authHeader.split(' ')[1]; // Extract the token

  try {
    const verified = jwt.verify(token, 'your_jwt_secret');
    
    const newArticle = new Article({
      ...req.body,
      userId: verified.id, // Associate the article with the logged-in user
    });

    await newArticle.save();
    res.status(201).send({ message: 'Article saved successfully' });
  } catch (error) {
    res.status(400).send('Invalid token');
  }
});

const fetchArticles = async () => {
  const response = await fetch(`http://localhost:${process.env.PORT}/saved-articles`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok) {
    const articlesData = await response.json();
    setArticles(articlesData);
  } else {
    console.error('Failed to fetch articles:', response.status, response.statusText);
    alert('Failed to fetch articles');
  }
};

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
  });
}




const PORT=process.env.PORT;

app.listen(PORT,()=>{
    console.log(`Server is running at port ${PORT}`);
    
})
