// The default policies are:
// 1.) Only the same origin can frame the app.
// 2.) No eval or other string-to-code, and content can only be loaded from the
// same origin as the app.
//
// Apps should call BrowserPolicy.disallowInlineScripts() if they are not
// using any inline script tags.
//
// BrowserPolicy functions for tweaking CSP:
// allowInlineScripts()
// disallowInlineScripts(): adds extra round-trip to page load time
// allowInlineStyles)(
// disallowInlineStyles()
// allowEval() (allows string-to-code like eval, innerHTML, etc.)
// disallowEval()
//
// allowScriptOrigin(origin): allows scripts to be loaded from the given origin
// allowScriptDataUrl(): allows scripts to be loaded from data: URLs
// allowScriptSameOrigin(): allows scripts to be loaded from the same origin
// disallowScript(): disallows all scripts
// and similar methods for object, img, media, frame, font, connect, style.
// XXX set default-src?
//
// For controlling which origins can frame this app,
// BrowserPolicy.disallowFraming()
// BrowserPolicy.allowFramingByOrigin(origin)
// BrowserPolicy.allowFramingBySameOrigin()
// BrowserPolicy.allowFramingByAnyOrigin();

// By default, only the same origin can frame the app.
var xFrameOptions;

// CSP keywords have to be single-quoted.
var unsafeInline = "'unsafe-inline'";
var unsafeEval = "'unsafe-eval'";
var selfKeyword = "'self'";
var noneKeyword = "'none'";

var cspSrcs;

var constructCsp = function () {
  _.each(_.keys(cspSrcs), function (directive) {
    if (_.isEmpty(cspSrcs[directive]))
      delete cspSrcs[directive];
  });

  var header = _.map(cspSrcs, function (srcs, directive) {
    return directive + " " + srcs.join(" ") + ";";
  }).join(" ");

  return header;
};

var parseCsp = function (csp) {
  var policies = csp.split("; ");
  var result = {};
  _.each(policies, function (policy) {
    if (policy[policy.length-1] === ";")
      policy = policy.substring(0, policy.length - 1);
    var srcs = policy.split(" ");
    var directive = srcs[0];
    result[directive] = srcs.slice(1);
  });
  return result;
};

var removeCspSrc = function (directive, src) {
  cspSrcs[directive] = _.without(cspSrcs[directive] || [], src);
};

var ensureDirective = function (directive) {
  if (! _.has(cspSrcs, directive))
    cspSrcs[directive] = [];
};

WebApp.connectHandlers.use(function (req, res, next) {
  if (xFrameOptions)
    res.setHeader("X-Frame-Options", xFrameOptions);
  if (cspSrcs)
    res.setHeader("Content-Security-Policy", constructCsp());
  next();
});

BrowserPolicy = {
  allowFramingBySameOrigin: function () {
    xFrameOptions = "SAMEORIGIN";
  },
  disallowFraming: function () {
    xFrameOptions = "DENY";
  },
  allowFramingByOrigin: function (origin) {
    xFrameOptions = "ALLOW-FROM " + origin;
  },
  allowFramingByAnyOrigin: function () {
    xFrameOptions = null;
  },

  setContentSecurityPolicy: function (csp) {
    cspSrcs = parseCsp(csp);
  },

  // Helpers for creating content security policies

  // Used by webapp to determine whether we need an extra round trip for
  // __meteor_runtime_config__.
  inlineScriptsAllowed: function () {
    ensureDirective("script-src");
    return (_.indexOf(cspSrcs["script-src"], unsafeInline) !== -1);
  },

  allowInlineScripts: function () {
    ensureDirective("script-src");
    cspSrcs["script-src"].push(unsafeInline);
  },
  disallowInlineScripts: function () {
    ensureDirective("script-src");
    removeCspSrc("script-src", unsafeInline);
  },
  allowEval: function () {
    ensureDirective("script-src");
    cspSrcs["script-src"].push(unsafeEval);
  },
  disallowEval: function () {
    ensureDirective("script-src");
    removeCspSrc("script-src", unsafeEval);
  },
  allowInlineStyles: function () {
    ensureDirective("style-src");
    cspSrcs["style-src"].push(unsafeInline);
  },
  disallowInlineStyles: function () {
    ensureDirective("style-src");
    removeCspSrc("style-src", unsafeInline);
  }
};

// allow<Resource>Origin, allow<Resource>Data, allow<Resource>self, and
// disallow<Resource> methods for each type of resource.
// XXX Should there also be disallow<Resource>Origin, disallow<Resource>Data,
// disallow<Resource>self?
_.each(["script", "object", "img", "media",
        "frame", "font", "connect", "style"],
       function (resource) {
         var directive = resource + "-src";
         var methodResource;
         if (resource !== "img") {
           methodResource = resource.charAt(0).toUpperCase() +
             resource.slice(1);
         } else {
           methodResource = "Image";
         }
         var allowMethodName = "allow" + methodResource + "Origin";
         var disallowMethodName = "disallow" + methodResource;
         var allowDataMethodName = "allow" + methodResource + "DataUrl";
         var allowSelfMethodName = "allow" + methodResource + "SameOrigin";

         BrowserPolicy[allowMethodName] = function (src) {
           ensureDirective(directive);
           cspSrcs[directive].push(src);
         };
         BrowserPolicy[disallowMethodName] = function () {
           cspSrcs[directive] = [noneKeyword];
         };
         BrowserPolicy[allowDataMethodName] = function () {
           ensureDirective(directive);
           cspSrcs[directive].push("data:");
         };
       });