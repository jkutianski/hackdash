/*
 * RESTfull API: Dashboard Resources
 *
 *
 */


var passport = require('passport')
  , mongoose = require('mongoose')
  , _ = require('underscore')
  , config = require('../../../config.json')
  , async = require('async');

var Project = mongoose.model('Project')
  , User = mongoose.model('User')
  , Dashboard = mongoose.model('Dashboard');

var maxLimit;

module.exports = function(app, uri, common) {
  maxLimit = app.get('config').maxQueryLimit || 50;

  app.post(uri + '/dashboards', common.isAuth, validateSubdomain, createDashboard(app), sendDashboard);
  app.get(uri + '/dashboards', setQuery, setDashboards, sendDashboards);

  app.get(uri + '/dashboards/:domain/csv', common.isAuth, getDashboard, isAdminDashboard, sendDashboardCSV);

  app.get(uri + '/dashboards/:domain.jsonp', setFullOption, getDashboard, sendDashboard);
  app.get(uri + '/dashboards/:domain', getDashboard, sendDashboard);
  app.get(uri + '/', getDashboard, sendDashboard);

  app.get(uri + '/dashboards/:domain/oembed', getDashboard, sendOembedDashboard);

  app.put(uri + '/dashboards/:domain', common.isAuth, getDashboard, isAdminDashboard, updateDashboard, sendDashboard);
  app.put(uri + '/', common.isAuth, getDashboard, isAdminDashboard, updateDashboard, sendDashboard);

  app.post(uri + '/', common.notAllowed);
  app.del(uri + '/', common.notAllowed);
};

var validateSubdomain = function(req, res, next) {

  if(!/^[a-z0-9]{5,10}$/.test(req.body.domain)) {
    return res.json(500, { error: "subdomain_invalid" });
  }

  next();
};

var createDashboard =  function(app){
  return function(req, res, next) {

    Dashboard.findOne({domain: req.body.domain}, function(err, dashboard){
      if(err || dashboard) {
        return res.json(409, { error: "subdomain_inuse" });
      }

      var dash = new Dashboard({ domain: req.body.domain});
      dash.save(function(err){

        User.findById(req.user.id, function(err, user) {

          user.admin_in.push(req.body.domain);

          user.save(function(){
            req.dashboard = dash;
            next();
          });
        });

      });
    });
  };
};

var setQuery = function(req, res, next){
  var query = req.query.q || "";
  req.limit = req.query.limit || maxLimit;
  req.page = req.query.page || 0;

  if (req.limit > maxLimit){
    req.limit = maxLimit;
  }

  req.search_query = {};

  if (query.length === 0){
    req.search_query.$and = [
      { projectsCount: { $gt : 1 } },
      { covers: { $exists: true } },
      { $where:'this.covers.length>0' }
    ];
    return next();
  }

  var regex = new RegExp(query, 'i');
  req.search_query.$or = [ { domain: regex }, { title: regex }, { description: regex } ];

  next();
};

var setDashboards = function(req, res, next){
  var limit = req.limit || maxLimit;

  Dashboard.find(req.search_query || {})
    .skip(req.page ? req.page*limit : 0)
    .limit(limit)
    .sort( { "created_at" : -1 } )
    .exec(function(err, dashboards) {
      if(err) return res.send(500);
      req.dashboards = dashboards || [];
      next();
    });
};

var getDashboard = function(req, res, next){
  var domain;

  if (req.subdomains.length > 0) {
    domain = req.subdomains[0];
  }
  else if (req.params.domain) {
    domain = req.params.domain;
  }
  else {
    return res.send(400, "Expected a dashboard name");
  }

  if (req.isFull){

      async.parallel({
        dashboard: function(done){
          Dashboard
            .findOne({ domain: domain })
            .select('-__v')
            .lean()
            .exec(done);
        },
        admins: function(done){
          User
            .find({ "admin_in": domain })
            .select('_id name picture bio')
            .lean()
            .exec(done);
        },
        projects: function(done){
          Project
            .find({ domain: domain })
            .select('-__v -tags')
            .populate('leader', '_id name picture bio')
            .sort('title')
            .lean()
            .exec(done);
        }
      }, function(err, data){

        if(err) return res.send(500);
        if(!data.dashboard) return res.send(404);

        data.projects = data.projects || [];

        data.projects.forEach(function(p) {
          p.cover = p.cover || '';
          p.contributors = p.contributors.length;
          p.followers = p.followers.length;
        });

        req.dashboard = data.dashboard;
        req.dashboard.projects = data.projects;
        req.dashboard.admins = data.admins;

        next();
      });

    return;
  }

  Dashboard
    .findOne({ domain: domain })
    .exec(function(err, dashboard) {
      if(err) return res.send(500);
      if(!dashboard) return res.send(404);
      req.dashboard = dashboard;
      next();
    });
};

var setFullOption = function(req, res, next){
  // Access support by script tag to get a Dashboard as JSONP
  req.isFull = true;
  next();
};

var isAdminDashboard = function(req, res, next){
  var isAdmin = (req.user.admin_in.indexOf(req.dashboard.domain) >= 0);

  if (!isAdmin) {
    return res.send(403, "Only Administrators are allowed for this action.");
  }

  next();
};

var updateDashboard = function(req, res, next) {
  var dashboard = req.dashboard;

  if(req.body.link && req.body.link.indexOf('http') != 0) {
    req.body.link = 'http://' + req.body.link;
  }

  function getValue(prop){
    return req.body.hasOwnProperty(prop) ? req.body[prop] : dashboard[prop];
  }

  dashboard.title = getValue("title");
  dashboard.description = getValue("description");
  dashboard.link = getValue("link");
  dashboard.open = getValue("open");

  var showcase = getValue("showcase");
  if (Array.isArray(showcase)){
    dashboard.showcase = showcase;
  }

  dashboard.save(function(err, dashboard){
    if(err) return res.send(500);
    req.dashboard = dashboard;
    next();
  });
};

var sendDashboard = function(req, res){
  if (req.isFull){
    res.jsonp(req.dashboard);
  }
  else {
    res.send(req.dashboard);
  }
};

var sendOembedDashboard = function(req, res){
  var base_url = {
        protocol: req.protocol,
        hostname: config.host,
        port: config.port
    }
    , collection_path = '/dashboard/' + req.dashboard._id
    , user_path = '/users/' + req.dashboard.leader._id
    , width = (typeof req.query.width !== undefined) ? req.query.width : null
    , height = (typeof req.query.height !== undefined) ? req.query.height : null ;

  var oembed = {
    type: 'rich',
    version: '1.0',
    provider_name: config.title,
    provider_url: url.format(base_url)
    title: req.dashboard.title,
    description: req.dashboard.description,
    author_name: req.dashboard.leader.name,
    author_url: url.format(_.extend(base_url, {path: user_path})),
    url: url.format(_.extend(base_url, {path: dashboard_path})),
    html: res.render('oembed_dashboard', {
        dashboard: req.dashboard,
        width: width,
        width: width,
        base_url: url.format(base_url),
        collection_path: collection_path
      })
    width: width,
    height: height
  };

var sendDashboards = function(req, res){
  res.send(req.dashboards);
};

var sendDashboardCSV = function(req, res){
  var domain = req.dashboard.domain;

  function CSVEscape(field) {
    return String(field || "").replace(/\"/g, '""').replace(/,/g, '');
  }

  var headers = [
      'name'
    , 'username'
    , 'provider'
    , 'e-mail'
    , 'engagement'
    , 'project'
    , 'status'
    , 'dashboard'
  ].map(CSVEscape).join(',');

  function projectToCSV(project) {

    var people = [];

    function addPerson(engagement, user){
      people.push([
          user.name
        , user.username
        , user.provider
        , user.email
        , engagement
        , project.title
        , project.status
        , domain
      ]);
    }

    _.each(project.contributors, addPerson.bind(null, "contributor"));
    _.each(project.followers, addPerson.bind(null, "follower"));

    // sort people by name ASC
    people.sort(function(a, b) { return a[0] - b[0]; });

    return (_.map(people, function(person){
      return person.map(CSVEscape).join(',') + '\n';
    })).join("");
  }

  var started = false;
  function start(response) {
    response.setHeader('Content-disposition', 'attachment; filename=' + domain + '.csv');
    response.contentType('csv');
    response.write(headers + '\n');
    started = true;
  }

  Project.find({ domain: domain })
    .populate('contributors')
    .populate('followers')
    .sort('title')
    .stream()
    .on('data', function (project) {
      if (!started) { start(res); }
      res.write(projectToCSV(project));
    })
    .on('close', function () {
      res.end();
    })
    .on('error', function (err) {
      res.send(500, {err: err, msg: "Failed to get projects"});
    });

};
