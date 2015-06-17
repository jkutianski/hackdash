HackDash
========

[![Join the chat at https://gitter.im/danzajdband/hackdash](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/danzajdband/hackdash?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Organize hackaton ideas into a dashboard

![HackDash Logo](http://i.imgur.com/XLQGF3y.png)

Install
===========

I wrote a [blog post](http://zajdband.com/installing-hackdash) explaining the installation process. Also check the [wiki](https://github.com/danzajdband/hackdash/wiki) for more info and docs

Config
======

In your `config.json`:

* `db`:
	+ `url`: Overrides other db config. Full MongoDB URL.
	+ `host`
	+ `port`
* `host`: Your instance host (i.e. yourdomain.com)
* `port`: Your port (i.e. 3000)
* `session`: Your session key (it must be a secret string)
* `title`: Instance title used in the html title tag and other headings.
* `live`: Boolean (true, false) that enable/disable the live feed feature in yourdomain.com/live.
* `mailer`: SMTP mail info to enable email notifications using nodemailer. Check out the [options](https://github.com/andris9/Nodemailer#setting-up-smtp)
* `team`: An array of `user`.`_id` to be shown as Team on Landing Page.
* `maxQueryLimit`: a Number for the max amount of results at the landing page searchs.
* `googleAnalytics`: the UA-XXXXXXXX-X code from Google Analytics. if not specified wont set the script.
* `prerender`: 
	+ `enabled`: Boolean (true, false). Where the website would use the SEO Prerender 
	+ `db`: The Mongo URI of Cached Pages.

Contribute
==========
Please check the [WIKI](https://github.com/danzajdband/hackdash/wiki)
