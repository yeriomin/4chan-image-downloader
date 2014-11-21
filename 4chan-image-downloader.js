// ==UserScript==
// @name         4chan Thread Image Downloader
// @namespace    https://github.com/yeriomin
// @downloadURL  https://raw.githubusercontent.com/yeriomin/4chan-image-downloader/master/4chan-image-downloader.js
// @updateURL    https://raw.githubusercontent.com/yeriomin/4chan-image-downloader/master/4chan-image-downloader.js
// @version      1.0
// @description  Downloads all images in a thread or the images of the highlighted poster packs them into an archive and presents to the user
// @author       yeriomin
// @match        http://boards.4chan.org/*/thread/*
// @match        https://boards.4chan.org/*/thread/*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js
// @require      https://raw.githubusercontent.com/Stuk/jszip/master/dist/jszip.min.js
// @require      https://raw.githubusercontent.com/Stuk/jszip-utils/master/dist/jszip-utils.min.js
// @require      https://raw.githubusercontent.com/eligrey/FileSaver.js/master/FileSaver.min.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {

    var isRunning = false;
    
    // Adding "Get images" button to top bar
    var linksBars = document.getElementsByClassName('navLinks desktop');
    if (linksBars.length == 0) {
        return false;
    }
    var aElement = document.createElement("a");
    aElement.setAttribute('href', '#');
    aElement.setAttribute('id', 'download-images');
    aElement.appendChild(document.createTextNode('Get images'));
    aElement.onclick = function () {
        onclickHandler();
        return false;
    };
    var linksBar = linksBars.item(0);
    linksBar.insertBefore(document.createTextNode('] '), linksBar.firstChild);
    linksBar.insertBefore(aElement, linksBar.firstChild);
    linksBar.insertBefore(document.createTextNode('['), linksBar.firstChild);

    /**
     * onclick handler
     * Launches download process and manages the progress flag
     *
     */
    function onclickHandler() {
        if (isRunning) {
            console.log('Already working');
            return false;
        }
        isRunning = true;        
        var posterId = getHighlightedPosterId();
        var imageUrls = getImageUrls(posterId);
        getAllImages(imageUrls, posterId);
        isRunning = false;
    }

    /**
     * Display job progress in the place designated for it
     *
     */
    function displayStatus(statusText) {
        document.getElementsByClassName('navLinks desktop').item(0).lastChild.innerHTML = statusText;
    }

    /**
     * Extract and return highlighted poster id if anything is highlighted
     *
     */
    function getHighlightedPosterId() {
        var highlightedPosts = document.getElementsByClassName('highlight');
        return highlightedPosts.length > 0
            ? getPosterId(highlightedPosts.item(0))
            : ''
        ;
    }

    /**
     * Extract poster if from a given post node
     *
     */
    function getPosterId(node) {
        if (node.getElementsByClassName('hand').length == 0) {
            return '';
        }
        return node.getElementsByClassName('hand').item(0).firstChild.nodeValue;
    }

    /**
     * Extract thread title and id from current URL
     *
     */
    function getThreadTitle() {
        var parts = location.pathname.split('/');
        var title = parts.pop();
        var id = parts.pop();
        return id + '-' + title;
    }

    /**
     * Walk all posts and get all images URLs and their file names
     * Filter by poster id if given
     *
     */
    function getImageUrls(highlightedPosterId) {
        var posts = document.getElementsByClassName('post');
        var imageUrls = {};
        for (var postNum in posts) {
            var post = posts.item(postNum);
            currentPosterId = getPosterId(post);
            if (highlightedPosterId != '' && currentPosterId != highlightedPosterId) {
                continue;
            }
            var fileTextElements = post.getElementsByClassName('fileText');
            if (fileTextElements.length < 1) {
                continue;
            }
            var aElement = fileTextElements.item(0).getElementsByTagName('a').item(0);
            var imageUrl = aElement.getAttribute('href');
            var fileName = aElement.hasAttribute('title') ? aElement.getAttribute('title') : aElement.firstChild.nodeValue;
            fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1, imageUrl.lastIndexOf('.')) + '-' + fileName;
            imageUrls[fileName] = 'http:' + imageUrl;
        }
        return imageUrls;
    }

    /**
     * Download the images
     *
     */
    function getAllImages(imageUrls, posterId) {
        var fileNames = {}, images = {}, complete = 0, total = Object.keys(imageUrls).length;        
        for (var fileName in imageUrls) {
            fileNames[imageUrls[fileName]] = fileName;
        }
        for (var fileName in imageUrls) {
            GM_xmlhttpRequest({
                method: "GET",
                url: imageUrls[fileName],
                responseType: "arraybuffer",
                onload: function(response) {
                    var currentFileName = fileNames[response.finalUrl];
                    images[currentFileName] = JSZipUtils._getBinaryFromXHR(response);
                    complete++;
                    var statusText = complete + ' of ' + total + ' files downloaded';
                    console.log(statusText);
                    displayStatus(statusText);
                    if (complete == total) {
                        finalizeAndDownloadZip(images, posterId);
                    }
                }
            });
        }
    }

    /**
     * Pack given images and present the archive to the user
     *
     */
    function finalizeAndDownloadZip(images, posterId) {
        var statusText = 'Building the archive';
        console.log(statusText);
        displayStatus(statusText);
        var zip = new JSZip();
        for (var fileName in images) {
            zip.file(fileName, images[fileName], {binary : true});
        }
        var blob = zip.generate({type: "blob"});
        var zipFileName = getThreadTitle() + (posterId == '' ? '' : '-' + posterId) + '.zip';
        saveAs(blob, zipFileName);
        displayStatus(' ');    
    }

})();