/*
 * RESTfull API: Collection Resources
 * 
 * 
 */

var passport = require('passport')
  , mongoose = require('mongoose')
  , _ = require('underscore')
  , config = require('../../../config.json');

var Collection = mongoose.model('Collection');
var maxLimit;

module.exports = function(app, uri, common) {
  maxLimit = app.get('config').maxQueryLimit || 50;

  // Get & Search all collections
  app.get(uri + '/collections', setQuery, getAllCollections, sendCollections);

  // Get user collections
  app.get(uri + '/collections/own', getUserCollections, sendCollections);

  // Create a user collection
  app.post(uri + '/collections', common.isAuth, createCollection, sendCollection);

  // Get a collection
  app.get(uri + '/collections/:cid', getCollection, sendCollection);

  // Get a collection OEMBED
  app.get(uri + '/collections/:cid/oembed', getCollection, sendOembedCollection);

  // Update a user collection
  app.put(uri + '/collections/:cid', common.isAuth, getCollection, isOwner, updateCollection);

  // Delete a user collection
  app.del(uri + '/collections/:cid', common.isAuth, getCollection, isOwner, removeCollection);

  // Add dashboard to a collection
  app.post(uri + '/collections/:cid/dashboards/:did', common.isAuth, getCollection, isOwner, addDashboard);

  // Remove dashboard from a collection
  app.del(uri + '/collections/:cid/dashboards/:did', common.isAuth, getCollection, isOwner, removeDashboard);

};

var setQuery = function(req, res, next){
  var query = req.query.q || "";
  req.limit = req.query.limit || maxLimit;

  if (req.limit > maxLimit){
    req.limit = maxLimit;
  }

  req.search_query = {};

  if (query.length === 0){
    return next();
  }

  var regex = new RegExp(query, 'i');
  req.search_query.$or = [ { title: regex }, { description: regex } ];

  next();
};

var getAllCollections = function(req, res, next){
  
  Collection.find(req.search_query || {})
    .limit(req.limit || maxLimit)
    .sort( { "created_at" : -1 } )
    .populate('owner')
    .populate('dashboards')
    .exec(function(err, collections) {
      if(err) return res.send(500);
      req.collections = collections || [];
      next();
    });
};

var getUserCollections = function(req, res, next){
  Collection.find({ "owner": req.user._id })
    .populate('owner')
    .populate('dashboards')
    .exec(function(err, collections) {
      if(err) return res.send(500);
      req.collections = collections || [];
      next();
    });
};

var getCollection = function(req, res, next){
  Collection.findById(req.params.cid)
    .populate('owner')
    .populate('dashboards')
    .exec(function(err, collection) {
      if (err) return res.send(500);
      if (!collection) return res.send(404);

      req.collection = collection;
      next();
  });
};

var isOwner = function(req, res, next){
  var isOwner = req.user.id === req.collection.owner.id;
  
  if (!isOwner) {
    return res.send(403, "Only Owner can modify this collection.");
  }

  next();
};

var createCollection = function(req, res, next){
    
  var collection = new Collection({
      title: req.body.title
    , description: req.body.description
    , created_at: Date.now()
    , owner: req.user._id
  });

  collection.save(function(err, collection){
    if(err) return res.send(500); 
    req.collection = collection;
    next();
  });
};

var updateCollection = function(req, res){
  var collection = req.collection;

  function getValue(prop){
    return req.body.hasOwnProperty(prop) ? req.body[prop] : collection[prop];    
  }

  collection.title = getValue("title");
  collection.description = getValue("description");
  
  collection.save(function(err, collection){
    if(err) return res.send(500);
    res.send(204);
  });
};

var removeCollection = function(req, res){
  req.collection.remove(function (err){
    if (err) return res.send(500, "An error ocurred when removing this collection");
    res.send(204);
  });
};

var addDashboard = function(req, res, next){
  var collectionId = req.collection.id;
  var dashboardId = req.params.did;

  Collection.update({ _id: collectionId }, { $addToSet : { 'dashboards': dashboardId }}, function(err){
    if(err) return res.send(500);
    res.send(204);
  });
};

var removeDashboard = function(req, res, next){
  var collectionId = req.collection.id;
  var dashboardId = req.params.did;

  Collection.update({ _id: collectionId }, { $pull : { 'dashboards': dashboardId }}, function(err){
    if(err) return res.send(500);
    res.send(204);
  });
};

var sendCollections = function(req, res){
  res.send(req.collections);
};

var sendCollection = function(req, res){
  res.send(req.collection);
};

var sendOembedCollection = function(req, res){
  var base_url = {
        protocol: req.protocol,
        hostname: config.host,
        port: config.port
    }
    , collection_path = '/collections/' + req.collection._id
    , user_path = '/users/' + req.collection.leader._id
    , width = (typeof req.query.width !== undefined) ? req.query.width : null
    , height = (typeof req.query.height !== undefined) ? req.query.height : null ;

  var oembed = {
    type: 'rich',
    version: '1.0',
    provider_name: config.title,
    provider_url: url.format({
        protocol: req.protocol,
        hostname: config.host,
        port: config.port
      })
    title: req.collection.title,
    description: req.collection.description,
    author_name: req.collection.leader.name,
    author_url: url.format(_.extend(base_url, {path: user_path})),
    url: url.format(_.extend(base_url, {path: collection_path})),
    html: res.render('oembed_collection', {
        collection: req.collection,
        width: width,
        width: width,
        base_url: url.format(base_url),
        collection_path: collection_path,
        css_url: req.query.css || url.format(_.extend(base_url, {path: '/styles/oembed.css'}))
      })
    width: width,
    height: height
  };
  
  res.send(oembed);
};
