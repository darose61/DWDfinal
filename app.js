var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
//Database
var mongo = require('mongoskin');
var db = mongo.db("mongodb://localhost:27017/nodetest2", {native_parser:true});

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

var util = require('util');
var multer = require('multer');

var stormpath = require('express-stormpath');

app.use(stormpath.init(app, {
  apiKeyId:     process.env.STORMPATH_API_KEY_ID,
  apiKeySecret: process.env.STORMPATH_API_KEY_SECRET,
  secretKey:    process.env.STORMPATH_SECRET_KEY,
  application:  process.env.STORMPATH_URL,
}));

app.use(multer());

var fs = require('fs');

var cloudinary = require('cloudinary');

if (!process.env.CLOUDINARY_URL) {
  throw new Error('You must set the environment variable `CLOUDINARY_URL`');
}

app.get('/cloudinary', stormpath.loginRequired, function(req, res){
  // Display a basic form that allows someone to upload a picture
  // Normally you would put this in your template directly, but
  // for the sake of simplicity we will just put together the HTML
  // in a string here and send it to the browser
  // The form MUST have the `enctype="multipart/form-data"` attribute
  // if you are uploading a file.
  res.send('<form action="/cloudinary" method="post" enctype="multipart/form-data">' +
     '<p>Image: <input type="file" name="image"/></p>' +
     '<p><input type="submit" value="Upload"/></p>' +
     '</form>');
});

app.post('/cloudinary', stormpath.loginRequired, function(req, res){
  console.log('req.files: ',req.files);

  var imageStream = fs.createReadStream(req.files.image.path);

  var cloudStream = cloudinary.uploader.upload_stream(function(result) {
    console.log('done uploading: ',result);

    var user = req.user;

    var dict = {
      user: user.email,
      url: result.url
    };
    db.collection('imageurls').insert(dict, function(err, result){
      console.log(err);

    });

    // The file is done uploading now.
    // You should save the uploaded url to your mongo database so
    // that you can retrieve and display it again later.
    res.send(
      '<img src="' + result.url + '">' + '<br>' +
      'Url: <a href="' + result.url + '">' + result.url + '</a>.<br>' +
      'Uploaded data: ' + util.inspect(result)
    );
  });

  imageStream.pipe(cloudStream);
});

// app.get('/', function(req, res){
//   if (req.user) {
//     // if the user is already signed in, redirect to the /secret page
//     console.log('/ req.user =',req.user);
//     res.redirect('/secret');
//   } else {
//     // if the user is not signed in, show a link to the login page
//     res.send('Visit <a href="/login">/login</a> to log in.');
//   }
// });

// This path uses the stormpath.loginRequired middleware to make it
// so that if the user isn't signed in it will redirect them to /login.
app.get('/secret', stormpath.loginRequired, function(req, res) {
  var user = req.user;

  db.collection('imageurls').find({user: user.email}).toArray(function(err, results) {
      var images = '';
      for (i = 0; i < results.length; i++) {
        images += '<img src="' + results[0].url + '">' + '<br>';
      };

      // Because we used the `stormpath.loginRequired` middleware,
      // we *know* that `req.user` will exist at this point.

      res.send('Hello, you are: ' + user.email + '<br/>' + images);
  })

});

var port = process.env.PORT || 3000;

app.listen(port, function(){
  console.log('listening on port ',port);
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//make our db accessible to our router
app.use(function(req,res,next){
  req.db=db;
  next();
});

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;

