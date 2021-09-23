
const URL_PREFIX = process.env.URL_PREFIX || '';

const fixUrl = url => url.replace('/'+URL_PREFIX,'') || '/';

exports.rmv = (req,res,next) => {
    if (!URL_PREFIX) return next();
    
    req.originalUrl = fixUrl(req.originalUrl);
    req.url = fixUrl(req.url);

    req._parsedUrl.pathname = fixUrl(req._parsedUrl.pathname);
    req._parsedUrl.path = fixUrl(req._parsedUrl.path);
    req._parsedUrl.href = fixUrl(req._parsedUrl.href);
    req._parsedUrl._raw = fixUrl(req._parsedUrl._raw);


    return next();
};

exports.add = url =>
    '/' + URL_PREFIX + fixUrl(url);