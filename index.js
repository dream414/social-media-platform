const cookieParser = require("cookie-parser");
const express = require("express");
const usermodel = require("./model/usermodel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const postmodel = require("./model/postmodel");
const path = require("path");
const upload = require("./Config/MulterConfig");

const app = express();

// ✅ Set View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// ✅ Login Middleware (protected routes)
function findlog(req, res, next) {
  if (!req.cookies || !req.cookies.token) {
    return res.redirect("/login");
  }
  try {
    let data = jwt.verify(req.cookies.token, "secret");
    req.user = data;
    next();
  } catch (err) {
    return res.send("Invalid token.");
  }
}

// 🏠 Home Page
app.get("/", (req, res) => {
  res.render("index");
});

// 🔰 Register Page
app.get("/register", (req, res) => {
  res.render("register");
});

// 📝 Register Action
app.post("/register", (req, res) => {
  const { password, email, name, username, age } = req.body;

  if (!password || !email || !name || !username || !age) {
    return res.send("All fields are required!");
  }

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      const u1 = await usermodel.create({
        name,
        username,
        age,
        password: hash,
        email,
        posts: [],
        profile: "default.png",
        followers: [],
        following: [],
      });

      const token = jwt.sign({ email }, "secret");
      res.cookie("token", token);

      return res.redirect("/profile");
    });
  });
});

// 🔐 Login Page
app.get("/login", (req, res) => {
  res.render("login");
});

// 🔓 Login Action
app.post("/loged", async (req, res) => {
  let user = await usermodel.findOne({ email: req.body.email });
  if (!user) return res.send("User not found!");

  bcrypt.compare(req.body.password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email: req.body.email }, "secret");
      res.cookie("token", token);
      return res.redirect("/profile");
    } else {
      return res.status(401).send("Invalid credentials");
    }
  });
});

// 🚪 Logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

// 👤 Profile Page
app.get("/profile", findlog, async (req, res) => {
  let user = await usermodel.findOne({ email: req.user.email }).populate("posts");
  res.render("profile", { user });
});

// ✏️ Create Post
app.post("/create2", findlog, async (req, res) => {
  let content = req.body.content;
  let user = await usermodel.findOne({ email: req.user.email });

  let post = await postmodel.create({
    user: user._id,
    content,
    likes: [],
    comments: [],
  });

  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");
});

// ❌ Delete Post
app.post("/delete/:id", findlog, async (req, res) => {
  await postmodel.findByIdAndDelete(req.params.id);
  await usermodel.updateOne(
    { email: req.user.email },
    { $pull: { posts: req.params.id } }
  );
  res.redirect("/profile");
});

// ❤️ Like / Unlike
app.get("/like/:id", findlog, async (req, res) => {
  let post = await postmodel.findById(req.params.id);
  const user = await usermodel.findOne({ email: req.user.email });

  const index = post.likes.findIndex(
    (id) => id.toString() === user._id.toString()
  );

  if (index === -1) {
    post.likes.push(user._id);
  } else {
    post.likes.splice(index, 1);
  }

  await post.save();
  res.redirect("/profile");
});

// ✏️ Edit Post Page
app.get("/edit/:id", findlog, async (req, res) => {
  let post = await postmodel.findById(req.params.id);
  res.render("edit", { post });
});

// ✏️ Update Post
app.post("/edit/:id", findlog, async (req, res) => {
  await postmodel.findByIdAndUpdate(req.params.id, { content: req.body.content });
  res.redirect("/profile");
});

// 📸 Upload Profile Picture
app.get("/profilepic/upload", findlog, (req, res) => {
  res.render("profilepicupload");
});

app.post("/upload", findlog, upload.single("image"), async (req, res) => {
  try {
    let user = await usermodel.findOne({ email: req.user.email });
    if (req.file) user.profile = req.file.filename;
    await user.save();
    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

// ✨ Edit Profile Info
app.get("/profile/edit", findlog, async (req, res) => {
  const user = await usermodel.findOne({ email: req.user.email });
  res.render("editprofile", { user });
});

app.post("/profile/update", findlog, async (req, res) => {
  const { name, username, age, email } = req.body;
  await usermodel.findOneAndUpdate(
    { email: req.user.email },
    { name, username, age, email }
  );
  res.redirect("/profile");
});

// 🌎 Explore Page
app.get("/explore", async (req, res) => {
  try {
    const posts = await postmodel.find().populate("user");
    res.render("explore", { posts });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading posts");
  }
});

// 🔍 Search
app.get("/search", findlog, async (req, res) => {
  const query = req.query.q;
  const users = await usermodel.find({
    name: { $regex: query, $options: "i" },
  });
  const posts = await postmodel.find({
    content: { $regex: query, $options: "i" },
  });
  res.render("search", { users, posts, query });
});

// ⚙️ Settings Page (only 1 route now)
app.get("/settings", findlog, async (req, res) => {
  const user = await usermodel.findOne({ email: req.user.email });
  res.render("settings", { user });
});

// ❌ Delete Account
app.post("/deleteaccount", findlog, async (req, res) => {
  await usermodel.findOneAndDelete({ email: req.user.email });
  res.clearCookie("token");
  res.redirect("/");
});

// 🚀 Start Server
app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});
