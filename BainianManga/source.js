(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Sources = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
"use strict";
/**
 * Request objects hold information for a particular source (see sources for example)
 * This allows us to to use a generic api to make the calls against any source
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Source = void 0;
class Source {
    constructor(cheerio) {
        // <-----------        OPTIONAL METHODS        -----------> //
        /**
         * Manages the ratelimits and the number of requests that can be done per second
         * This is also used to fetch pages when a chapter is downloading
         */
        this.requestManager = createRequestManager({
            requestsPerSecond: 2.5,
            requestTimeout: 5000
        });
        this.cheerio = cheerio;
    }
    /**
     * (OPTIONAL METHOD) This function is called when ANY request is made by the Paperback Application out to the internet.
     * By modifying the parameter and returning it, the user can inject any additional headers, cookies, or anything else
     * a source may need to load correctly.
     * The most common use of this function is to add headers to image requests, since you cannot directly access these requests through
     * the source implementation itself.
     *
     * NOTE: This does **NOT** influence any requests defined in the source implementation. This function will only influence requests
     * which happen behind the scenes and are not defined in your source.
     */
    globalRequestHeaders() { return {}; }
    globalRequestCookies() { return []; }
    /**
     * A stateful source may require user input.
     * By supplying this value to the Source, the app will render your form to the user
     * in the application settings.
     */
    getAppStatefulForm() { return createUserForm({ formElements: [] }); }
    /**
     * When the Advanced Search is rendered to the user, this skeleton defines what
     * fields which will show up to the user, and returned back to the source
     * when the request is made.
     */
    getAdvancedSearchForm() { return createUserForm({ formElements: [] }); }
    /**
     * (OPTIONAL METHOD) Given a manga ID, return a URL which Safari can open in a browser to display.
     * @param mangaId
     */
    getMangaShareUrl(mangaId) { return null; }
    /**
     * If a source is secured by Cloudflare, this method should be filled out.
     * By returning a request to the website, this source will attempt to create a session
     * so that the source can load correctly.
     * Usually the {@link Request} url can simply be the base URL to the source.
     */
    getCloudflareBypassRequest() { return null; }
    /**
     * (OPTIONAL METHOD) A function which communicates with a given source, and returns a list of all possible tags which the source supports.
     * These tags are generic and depend on the source. They could be genres such as 'Isekai, Action, Drama', or they can be
     * listings such as 'Completed, Ongoing'
     * These tags must be tags which can be used in the {@link searchRequest} function to augment the searching capability of the application
     */
    getTags() { return Promise.resolve(null); }
    /**
     * (OPTIONAL METHOD) A function which should scan through the latest updates section of a website, and report back with a list of IDs which have been
     * updated BEFORE the supplied timeframe.
     * This function may have to scan through multiple pages in order to discover the full list of updated manga.
     * Because of this, each batch of IDs should be returned with the mangaUpdatesFoundCallback. The IDs which have been reported for
     * one page, should not be reported again on another page, unless the relevent ID has been detected again. You do not want to persist
     * this internal list between {@link Request} calls
     * @param mangaUpdatesFoundCallback A callback which is used to report a list of manga IDs back to the API
     * @param time This function should find all manga which has been updated between the current time, and this parameter's reported time.
     *             After this time has been passed, the system should stop parsing and return
     */
    filterUpdatedManga(mangaUpdatesFoundCallback, time, ids) { return Promise.resolve(); }
    /**
     * (OPTIONAL METHOD) A function which should readonly allf the available homepage sections for a given source, and return a {@link HomeSection} object.
     * The sectionCallback is to be used for each given section on the website. This may include a 'Latest Updates' section, or a 'Hot Manga' section.
     * It is recommended that before anything else in your source, you first use this sectionCallback and send it {@link HomeSection} objects
     * which are blank, and have not had any requests done on them just yet. This way, you provide the App with the sections to render on screen,
     * which then will be populated with each additional sectionCallback method called. This is optional, but recommended.
     * @param sectionCallback A callback which is run for each independant HomeSection.
     */
    getHomePageSections(sectionCallback) { return Promise.resolve(); }
    /**
     * (OPTIONAL METHOD) This function will take a given homepageSectionId and metadata value, and with this information, should return
     * all of the manga tiles supplied for the given state of parameters. Most commonly, the metadata value will contain some sort of page information,
     * and this request will target the given page. (Incrementing the page in the response so that the next call will return relevent data)
     * @param homepageSectionId The given ID to the homepage defined in {@link getHomePageSections} which this method is to readonly moreata about
     * @param metadata This is a metadata parameter which is filled our in the {@link getHomePageSections}'s return
     * function. Afterwards, if the metadata value returned in the {@link PagedResults} has been modified, the modified version
     * will be supplied to this function instead of the origional {@link getHomePageSections}'s version.
     * This is useful for keeping track of which page a user is on, pagnating to other pages as ViewMore is called multiple times.
     */
    getViewMoreItems(homepageSectionId, metadata) { return Promise.resolve(null); }
    /**
     * (OPTIONAL METHOD) This function is to return the entire library of a manga website, page by page.
     * If there is an additional page which needs to be called, the {@link PagedResults} value should have it's metadata filled out
     * with information needed to continue pulling information from this website.
     * Note that if the metadata value of {@link PagedResults} is undefined, this method will not continue to run when the user
     * attempts to readonly morenformation
     * @param metadata Identifying information as to what the source needs to call in order to readonly theext batch of data
     * of the directory. Usually this is a page counter.
     */
    getWebsiteMangaDirectory(metadata) { return Promise.resolve(null); }
    // <-----------        PROTECTED METHODS        -----------> //
    // Many sites use '[x] time ago' - Figured it would be good to handle these cases in general
    convertTime(timeAgo) {
        var _a;
        let time;
        let trimmed = Number(((_a = /\d*/.exec(timeAgo)) !== null && _a !== void 0 ? _a : [])[0]);
        trimmed = (trimmed == 0 && timeAgo.includes('a')) ? 1 : trimmed;
        if (timeAgo.includes('minutes')) {
            time = new Date(Date.now() - trimmed * 60000);
        }
        else if (timeAgo.includes('hours')) {
            time = new Date(Date.now() - trimmed * 3600000);
        }
        else if (timeAgo.includes('days')) {
            time = new Date(Date.now() - trimmed * 86400000);
        }
        else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000);
        }
        else {
            time = new Date(Date.now());
        }
        return time;
    }
    /**
     * When a function requires a POST body, it always should be defined as a JsonObject
     * and then passed through this function to ensure that it's encoded properly.
     * @param obj
     */
    urlEncodeObject(obj) {
        let ret = {};
        for (const entry of Object.entries(obj)) {
            ret[encodeURIComponent(entry[0])] = encodeURIComponent(entry[1]);
        }
        return ret;
    }
}
exports.Source = Source;

},{}],3:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./Source"), exports);

},{"./Source":2}],4:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./base"), exports);
__exportStar(require("./models"), exports);
__exportStar(require("./APIWrapper"), exports);

},{"./APIWrapper":1,"./base":3,"./models":25}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],6:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],7:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],8:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageCode = void 0;
var LanguageCode;
(function (LanguageCode) {
    LanguageCode["UNKNOWN"] = "_unknown";
    LanguageCode["BENGALI"] = "bd";
    LanguageCode["BULGARIAN"] = "bg";
    LanguageCode["BRAZILIAN"] = "br";
    LanguageCode["CHINEESE"] = "cn";
    LanguageCode["CZECH"] = "cz";
    LanguageCode["GERMAN"] = "de";
    LanguageCode["DANISH"] = "dk";
    LanguageCode["ENGLISH"] = "gb";
    LanguageCode["SPANISH"] = "es";
    LanguageCode["FINNISH"] = "fi";
    LanguageCode["FRENCH"] = "fr";
    LanguageCode["WELSH"] = "gb";
    LanguageCode["GREEK"] = "gr";
    LanguageCode["CHINEESE_HONGKONG"] = "hk";
    LanguageCode["HUNGARIAN"] = "hu";
    LanguageCode["INDONESIAN"] = "id";
    LanguageCode["ISRELI"] = "il";
    LanguageCode["INDIAN"] = "in";
    LanguageCode["IRAN"] = "ir";
    LanguageCode["ITALIAN"] = "it";
    LanguageCode["JAPANESE"] = "jp";
    LanguageCode["KOREAN"] = "kr";
    LanguageCode["LITHUANIAN"] = "lt";
    LanguageCode["MONGOLIAN"] = "mn";
    LanguageCode["MEXIAN"] = "mx";
    LanguageCode["MALAY"] = "my";
    LanguageCode["DUTCH"] = "nl";
    LanguageCode["NORWEGIAN"] = "no";
    LanguageCode["PHILIPPINE"] = "ph";
    LanguageCode["POLISH"] = "pl";
    LanguageCode["PORTUGUESE"] = "pt";
    LanguageCode["ROMANIAN"] = "ro";
    LanguageCode["RUSSIAN"] = "ru";
    LanguageCode["SANSKRIT"] = "sa";
    LanguageCode["SAMI"] = "si";
    LanguageCode["THAI"] = "th";
    LanguageCode["TURKISH"] = "tr";
    LanguageCode["UKRAINIAN"] = "ua";
    LanguageCode["VIETNAMESE"] = "vn";
})(LanguageCode = exports.LanguageCode || (exports.LanguageCode = {}));

},{}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangaStatus = void 0;
var MangaStatus;
(function (MangaStatus) {
    MangaStatus[MangaStatus["ONGOING"] = 1] = "ONGOING";
    MangaStatus[MangaStatus["COMPLETED"] = 0] = "COMPLETED";
})(MangaStatus = exports.MangaStatus || (exports.MangaStatus = {}));

},{}],11:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],12:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],13:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],14:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],15:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],16:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],17:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],18:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],19:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],20:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagType = void 0;
/**
 * An enumerator which {@link SourceTags} uses to define the color of the tag rendered on the website.
 * Five types are available: blue, green, grey, yellow and red, the default one is blue.
 * Common colors are red for (Broken), yellow for (+18), grey for (Country-Proof)
 */
var TagType;
(function (TagType) {
    TagType["BLUE"] = "default";
    TagType["GREEN"] = "success";
    TagType["GREY"] = "info";
    TagType["YELLOW"] = "warning";
    TagType["RED"] = "danger";
})(TagType = exports.TagType || (exports.TagType = {}));

},{}],22:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],23:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],24:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],25:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./Chapter"), exports);
__exportStar(require("./ChapterDetails"), exports);
__exportStar(require("./HomeSection"), exports);
__exportStar(require("./Manga"), exports);
__exportStar(require("./MangaTile"), exports);
__exportStar(require("./RequestObject"), exports);
__exportStar(require("./SearchRequest"), exports);
__exportStar(require("./TagSection"), exports);
__exportStar(require("./SourceTag"), exports);
__exportStar(require("./Languages"), exports);
__exportStar(require("./Constants"), exports);
__exportStar(require("./MangaUpdate"), exports);
__exportStar(require("./PagedResults"), exports);
__exportStar(require("./ResponseObject"), exports);
__exportStar(require("./RequestManager"), exports);
__exportStar(require("./RequestHeaders"), exports);
__exportStar(require("./SourceInfo"), exports);
__exportStar(require("./TrackObject"), exports);
__exportStar(require("./OAuth"), exports);
__exportStar(require("./UserForm"), exports);

},{"./Chapter":5,"./ChapterDetails":6,"./Constants":7,"./HomeSection":8,"./Languages":9,"./Manga":10,"./MangaTile":11,"./MangaUpdate":12,"./OAuth":13,"./PagedResults":14,"./RequestHeaders":15,"./RequestManager":16,"./RequestObject":17,"./ResponseObject":18,"./SearchRequest":19,"./SourceInfo":20,"./SourceTag":21,"./TagSection":22,"./TrackObject":23,"./UserForm":24}],26:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BainianManga = exports.BainianMangaInfo = void 0;
const paperback_extensions_common_1 = require("paperback-extensions-common");
const BainianMangaParser_1 = require("./BainianMangaParser");
const BM_DOMAIN = 'https://m.bnmanhua.com';
const BM_IMAGE_DOMAIN = 'https://img.lxhy88.com';
const method = 'GET';
const headers = {
    referer: BM_DOMAIN
};
exports.BainianMangaInfo = {
    version: '1.0.0',
    name: 'BainianManga (百年漫画)',
    icon: 'favicon.png',
    author: 'getBoolean',
    authorWebsite: 'https://github.com/getBoolean',
    description: 'Extension that pulls manga from BainianManga',
    hentaiSource: false,
    websiteBaseURL: `${BM_DOMAIN}/comic.html`,
    sourceTags: [
        {
            text: "中文",
            type: paperback_extensions_common_1.TagType.GREY
        }
    ]
};
class BainianManga extends paperback_extensions_common_1.Source {
    constructor() {
        super(...arguments);
        this.imageDomain = BM_IMAGE_DOMAIN;
    }
    getMangaShareUrl(mangaId) { return `${BM_DOMAIN}/comic/${mangaId}`; }
    getMangaDetails(mangaId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.imageDomain = BM_IMAGE_DOMAIN; // Reset image domain back to this
            const request = createRequestObject({
                url: `${BM_DOMAIN}/comic/`,
                method,
                param: `${mangaId}.html`
            });
            const response = yield this.requestManager.schedule(request, 1);
            const $ = this.cheerio.load(response.data);
            let result = BainianMangaParser_1.parseMangaDetails($, mangaId);
            // Hacky solution to get the image domain
            // Get image domain from (ex:) https://img.lxhy88.com/zhang/26110/1602252/d41ae644ddcd2e1edb8141f0b5abf8c1.jpg
            const image = result[1].replace('https://', '').replace('http://', '');
            const tempImageDomain = image.substring(0, image.indexOf('/')); // Set new image domain
            this.imageDomain = `https://${tempImageDomain}`;
            // console.log(this.imageDomain)
            return result[0];
        });
    }
    getChapters(mangaId) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = createRequestObject({
                url: `${BM_DOMAIN}/comic/`,
                method,
                param: `${mangaId}.html`
            });
            const response = yield this.requestManager.schedule(request, 1);
            const $ = this.cheerio.load(response.data);
            return BainianMangaParser_1.parseChapters($, mangaId);
        });
    }
    getChapterDetails(mangaId, chapterId) {
        return __awaiter(this, void 0, void 0, function* () {
            let request = createRequestObject({
                url: `${BM_DOMAIN}/comic/`,
                method,
                headers,
                param: `${mangaId}/${chapterId}.html`
            });
            const response = yield this.requestManager.schedule(request, 1);
            const $ = this.cheerio.load(response.data);
            return BainianMangaParser_1.parseChapterDetails(this.imageDomain, mangaId, chapterId, response.data);
        });
    }
    filterUpdatedManga(mangaUpdatesFoundCallback, time, ids) {
        return __awaiter(this, void 0, void 0, function* () {
            let page = 1;
            let updatedManga = {
                ids: [],
                loadMore: true
            };
            while (updatedManga.loadMore) {
                const request = createRequestObject({
                    url: `${BM_DOMAIN}/page/new/`,
                    method,
                    headers,
                    param: `${String(page++)}.html`
                });
                const response = yield this.requestManager.schedule(request, 1);
                const $ = this.cheerio.load(response.data);
                updatedManga = BainianMangaParser_1.parseUpdatedManga($, time, ids);
                if (updatedManga.ids.length > 0) {
                    mangaUpdatesFoundCallback(createMangaUpdates({
                        ids: updatedManga.ids
                    }));
                }
            }
        });
    }
    getHomePageSections(sectionCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            // Give Paperback a skeleton of what these home sections should look like to pre-render them
            const section1 = createHomeSection({ id: 'a_recommended', title: '推荐漫画' });
            const section3 = createHomeSection({ id: 'hot_comics', title: '热门漫画', view_more: true });
            const section2 = createHomeSection({ id: 'z_new_updates', title: '最近更新', view_more: true });
            // Fill the homsections with data
            const request1 = createRequestObject({
                url: `${BM_DOMAIN}/comic.html`,
                method,
            });
            const request2 = createRequestObject({
                url: `${BM_DOMAIN}/page/hot/1.html`,
                method,
            });
            const request3 = createRequestObject({
                url: `${BM_DOMAIN}/page/new/1.html`,
                method,
            });
            const response1 = yield this.requestManager.schedule(request1, 1);
            const $1 = this.cheerio.load(response1.data);
            const response2 = yield this.requestManager.schedule(request2, 1);
            const $2 = this.cheerio.load(response2.data);
            const response3 = yield this.requestManager.schedule(request3, 1);
            const $3 = this.cheerio.load(response3.data);
            BainianMangaParser_1.parseHomeSections($1, section1, sectionCallback);
            BainianMangaParser_1.parseHotManga($2, section2, sectionCallback);
            BainianMangaParser_1.parseNewManga($3, section3, sectionCallback);
        });
    }
    searchRequest(query, metadata) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let page = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.page) !== null && _a !== void 0 ? _a : 1;
            const search = BainianMangaParser_1.generateSearch(query);
            const request = createRequestObject({
                url: `${BM_DOMAIN}/search/`,
                method,
                headers,
                param: `${search}/${page}.html`
            });
            const response = yield this.requestManager.schedule(request, 1);
            const $ = this.cheerio.load(response.data);
            const manga = BainianMangaParser_1.parseSearch($);
            metadata = !BainianMangaParser_1.isLastPage($) ? { page: page + 1 } : undefined;
            return createPagedResults({
                results: manga,
                metadata
            });
        });
    }
    getTags() {
        return __awaiter(this, void 0, void 0, function* () {
            const request = createRequestObject({
                url: `${BM_DOMAIN}/page/list.html`,
                method,
                headers,
            });
            const response = yield this.requestManager.schedule(request, 1);
            const $ = this.cheerio.load(response.data);
            return BainianMangaParser_1.parseTags($);
        });
    }
    getViewMoreItems(homepageSectionId, metadata) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // console.log('getViewMoreItems($)')
            let page = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.page) !== null && _a !== void 0 ? _a : 1;
            let param = '';
            if (homepageSectionId === 'hot_comics')
                param = `/page/hot/${page}.html`;
            else if (homepageSectionId === 'z_new_updates')
                param = `/page/new/${page}.html`;
            else
                return Promise.resolve(null);
            const request = createRequestObject({
                url: `${BM_DOMAIN}`,
                method,
                param,
            });
            const response = yield this.requestManager.schedule(request, 1);
            const $ = this.cheerio.load(response.data);
            const manga = BainianMangaParser_1.parseViewMore($);
            // console.log('isLastPage($) ' + isLastPage($))
            metadata = !BainianMangaParser_1.isLastPage($) ? { page: page + 1 } : undefined;
            return createPagedResults({
                results: manga,
                metadata
            });
        });
    }
    globalRequestHeaders() {
        return {
            referer: BM_DOMAIN
        };
    }
}
exports.BainianManga = BainianManga;

},{"./BainianMangaParser":27,"paperback-extensions-common":4}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLastPage = exports.parseViewMore = exports.parseTags = exports.parseSearch = exports.generateSearch = exports.parseNewManga = exports.parseHotManga = exports.parseHomeSections = exports.parseUpdatedManga = exports.parseChapterDetails = exports.parseChapters = exports.parseMangaDetails = void 0;
const paperback_extensions_common_1 = require("paperback-extensions-common");
exports.parseMangaDetails = ($, mangaId) => {
    var _a, _b;
    const json = (_b = (_a = $('[type=application\\/ld\\+json]').html()) === null || _a === void 0 ? void 0 : _a.replace(/\t*\n*/g, '')) !== null && _b !== void 0 ? _b : '';
    const parsedJson = JSON.parse(json);
    const infoElement = $('div.data');
    const title = parsedJson.title;
    const image = parsedJson.images[0];
    let author = $('.dir', infoElement).text().trim().replace('作者：', '');
    let artist = '';
    let rating = 0;
    let status = $('span.list_item ').text() == '连载中' ? paperback_extensions_common_1.MangaStatus.ONGOING : paperback_extensions_common_1.MangaStatus.COMPLETED;
    let titles = [title];
    let follows = 0;
    let views = 0;
    let lastUpdate = '';
    let hentai = false;
    const tagSections = [createTagSection({ id: '0', label: 'genres', tags: [] })];
    const elems = $('.yac', infoElement).find('a').toArray();
    tagSections[0].tags = elems.map((elem) => createTag({ id: $(elem).text(), label: $(elem).text() }));
    const time = new Date(parsedJson.upDate);
    lastUpdate = time.toDateString();
    const summary = parsedJson.description;
    return [createManga({
            id: mangaId,
            titles,
            image,
            rating: Number(rating),
            status,
            artist,
            author,
            tags: tagSections,
            views,
            follows,
            lastUpdate,
            desc: summary,
            hentai
        }), image];
};
exports.parseChapters = ($, mangaId) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const json = (_b = (_a = $('[type=application\\/ld\\+json]').html()) === null || _a === void 0 ? void 0 : _a.replace(/\t*\n*/g, '')) !== null && _b !== void 0 ? _b : '';
    const parsedJson = JSON.parse(json);
    const time = new Date(parsedJson.upDate); // Set time for all chapters to be the last updated time
    const allChapters = $('li', '.list_block ').toArray();
    const chapters = [];
    let index;
    for (let chapter of allChapters) {
        const id = ((_d = (_c = $('a', chapter).attr('href')) === null || _c === void 0 ? void 0 : _c.split('/').pop()) !== null && _d !== void 0 ? _d : '').replace('.html', '');
        const name = (_e = $('a', chapter).text()) !== null && _e !== void 0 ? _e : '';
        let tempChapNum = Number((_f = name.match(/\d+/)) !== null && _f !== void 0 ? _f : 0);
        if (tempChapNum == 0) {
            index = allChapters.indexOf(chapter);
            if (index < allChapters.length - 1) {
                const nextName = (_g = $('a', allChapters[index + 1]).text()) !== null && _g !== void 0 ? _g : '';
                tempChapNum = Number((_h = nextName.match(/\d+/)) !== null && _h !== void 0 ? _h : 0) + 0.5;
            }
        }
        const chapNum = tempChapNum;
        chapters.push(createChapter({
            id,
            mangaId,
            name,
            langCode: paperback_extensions_common_1.LanguageCode.CHINEESE,
            chapNum,
            time
        }));
    }
    return chapters;
};
exports.parseChapterDetails = (imageDomain, mangaId, chapterId, data) => {
    var _a;
    const baseImageURL = imageDomain;
    const imageCode = (_a = data === null || data === void 0 ? void 0 : data.match(/var z_img='(.*?)';/)) === null || _a === void 0 ? void 0 : _a.pop();
    // console.log("data?.match(/var z_img='(.*?)';/): " + data?.match(/var z_img='(.*?)';/))
    // console.log('imageCode: ' + imageCode)
    let pages = [];
    if (imageCode) {
        const imagePaths = JSON.parse(imageCode);
        pages = imagePaths.map(imagePath => `${baseImageURL}/${imagePath}`);
    }
    // console.log(pages)
    return createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages,
        longStrip: false
    });
};
exports.parseUpdatedManga = ($, time, ids) => {
    var _a, _b;
    const foundIds = [];
    let passedReferenceTime = false;
    const panel = $('.tbox_m');
    const allItems = $('.vbox', panel).toArray();
    for (const item of allItems) {
        const id = ((_b = ((_a = $('a', item).first().attr('href')) !== null && _a !== void 0 ? _a : '').split('/').pop()) !== null && _b !== void 0 ? _b : '').replace('.html', '');
        let mangaTime = new Date($($(item).find('h4')[1]).text());
        passedReferenceTime = mangaTime > time;
        if (passedReferenceTime) {
            if (ids.includes(id)) {
                foundIds.push(id);
            }
        }
        else
            break;
    }
    return {
        ids: foundIds,
        loadMore: passedReferenceTime
    };
};
exports.parseHomeSections = ($, section, sectionCallback) => {
    var _a, _b, _c, _d;
    sectionCallback(section);
    const recommendedManga = [];
    // Recommended
    const grid = $('.tbox_m')[0];
    const allItems = $('.vbox', grid).toArray();
    for (const item of allItems) {
        const id = ((_b = ((_a = $('a', item).first().attr('href')) !== null && _a !== void 0 ? _a : '').split('/').pop()) !== null && _b !== void 0 ? _b : '').replace('.html', '');
        const title = (_c = $('.vbox_t', item).attr('title')) !== null && _c !== void 0 ? _c : 'No title';
        const subtitle = $('.vbox_t span', item).text();
        const image = (_d = $('.vbox_t mip-img', item).attr('src')) !== null && _d !== void 0 ? _d : '';
        recommendedManga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle })
        }));
    }
    section.items = recommendedManga;
    // Perform the callbacks again now that the home page sections are filled with data
    sectionCallback(section);
};
exports.parseHotManga = ($, section, sectionCallback) => {
    var _a, _b, _c, _d;
    sectionCallback(section);
    const hotManga = [];
    // New
    const grid = $('.tbox_m')[0];
    const allItems = $('.vbox', grid).toArray();
    for (const item of allItems) {
        const id = ((_b = ((_a = $('a', item).first().attr('href')) !== null && _a !== void 0 ? _a : '').split('/').pop()) !== null && _b !== void 0 ? _b : '').replace('.html', '');
        const title = (_c = $('.vbox_t', item).attr('title')) !== null && _c !== void 0 ? _c : 'No title';
        const subtitle = $('.vbox_t span', item).text();
        const image = (_d = $('.vbox_t mip-img', item).attr('src')) !== null && _d !== void 0 ? _d : '';
        hotManga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle })
        }));
    }
    section.items = hotManga;
    // Perform the callbacks again now that the home page sections are filled with data
    sectionCallback(section);
};
exports.parseNewManga = ($, section, sectionCallback) => {
    var _a, _b, _c, _d;
    sectionCallback(section);
    const newManga = [];
    // New
    const grid = $('.tbox_m')[0];
    const allItems = $('.vbox', grid).toArray();
    for (const item of allItems) {
        const id = ((_b = ((_a = $('a', item).first().attr('href')) !== null && _a !== void 0 ? _a : '').split('/').pop()) !== null && _b !== void 0 ? _b : '').replace('.html', '');
        const title = (_c = $('.vbox_t', item).attr('title')) !== null && _c !== void 0 ? _c : 'No title';
        const subtitle = $('.vbox_t span', item).text();
        const image = (_d = $('.vbox_t mip-img', item).attr('src')) !== null && _d !== void 0 ? _d : '';
        newManga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle })
        }));
    }
    section.items = newManga;
    // Perform the callbacks again now that the home page sections are filled with data
    sectionCallback(section);
};
exports.generateSearch = (query) => {
    var _a, _b;
    let keyword = ((_a = query.title) !== null && _a !== void 0 ? _a : '').replace(/ /g, '+');
    if (query.author)
        keyword += ((_b = query.author) !== null && _b !== void 0 ? _b : '').replace(/ /g, '+');
    let search = `${keyword}`;
    return search;
};
exports.parseSearch = ($) => {
    var _a, _b, _c, _d;
    const panel = $('.tbox_m');
    const allItems = $('.vbox', panel).toArray();
    const manga = [];
    for (const item of allItems) {
        const id = ((_b = ((_a = $('a', item).first().attr('href')) !== null && _a !== void 0 ? _a : '').split('/').pop()) !== null && _b !== void 0 ? _b : '').replace('.html', '');
        const title = (_c = $('.vbox_t', item).attr('title')) !== null && _c !== void 0 ? _c : 'No title';
        const subtitle = $('.vbox_t span', item).text();
        const image = (_d = $('.vbox_t mip-img', item).attr('src')) !== null && _d !== void 0 ? _d : '';
        manga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle }),
        }));
    }
    return manga;
};
exports.parseTags = ($) => {
    const allItems = $('.tbox a').toArray();
    const genres = createTagSection({
        id: 'genre',
        label: 'Genre',
        tags: []
    });
    for (let item of allItems) {
        // let id = ($(item).attr('href')?.split('/').pop() ?? '').replace('.html', '')
        let label = $(item).text();
        genres.tags.push(createTag({ id: label, label: label }));
    }
    return [genres];
};
exports.parseViewMore = ($) => {
    var _a, _b, _c, _d;
    // console.log('parseViewMore($)')
    const panel = $('.tbox_m');
    const allItems = $('.vbox', panel).toArray();
    const manga = [];
    for (const item of allItems) {
        const id = ((_b = ((_a = $('a', item).first().attr('href')) !== null && _a !== void 0 ? _a : '').split('/').pop()) !== null && _b !== void 0 ? _b : '').replace('.html', '');
        const title = (_c = $('.vbox_t', item).attr('title')) !== null && _c !== void 0 ? _c : 'No title';
        const subtitle = $('.vbox_t span', item).text();
        const image = (_d = $('.vbox_t mip-img', item).attr('src')) !== null && _d !== void 0 ? _d : '';
        manga.push(createMangaTile({
            id,
            image,
            title: createIconText({ text: title }),
            subtitleText: createIconText({ text: subtitle }),
        }));
    }
    return manga;
};
exports.isLastPage = ($) => {
    // const pagenav = $('.pagination')
    let disabled = $('li', $('.pagination')).last().hasClass('disabled');
    return disabled;
};

},{"paperback-extensions-common":4}]},{},[26])(26)
});
