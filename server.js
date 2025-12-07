const express = require('express');
const path = require('path');

const app = express();
const PORT = 5833;


app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// routes
const indexRouter = require('./routes/home.route');
app.use('/', indexRouter);

app.use(express.static(path.join(__dirname, 'public')));


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
