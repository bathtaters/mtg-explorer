function mtgExplorerGetImages() {
    function getImgUrl(scryfallId) {
        return `https://api.scryfall.com/cards/${scryfallId}?format=image&version=border_crop`;
    }
    var localCache = {};
    
    function placeImage(wrapper) {
        var newImage = document.createElement('img');
        newImage.src = localCache[wrapper.id];
        newImage.classList.add('thumbnail-img');
        wrapper.appendChild(newImage);
    }

    function fetchImages(arr, i=0) {
        var cont = i + 1 < arr.length;
        if (localCache[arr[i].id]) {
            placeImage(arr[i]);
            return cont && fetchImages(arr, i+1);
        }
        return fetch(getImgUrl(arr[i].id))
            .then(response => response.blob())
            .then(imageBlob => {
                var imgURL = URL.createObjectURL(imageBlob);
                localCache[arr[i].id] = imgURL;
                placeImage(arr[i]);
                cont && setTimeout(()=>fetchImages(arr, i+1),100);
            });
    }

    function loadImages() {
        var imgs = document.getElementsByClassName('thumbnail');
        return fetchImages(imgs);
    }

    function addListener(elem, listener,func,useCapture=false) {
        if (!elem || elem === 'window' || elem === 'document' || elem === document) {
            elem = window; }
        if (elem.addEventListener) {
            elem.addEventListener(listener,func,useCapture);
        } else if(elem.attachEvent) {
            if (listener.substring(0,2).toLowerCase() != "on") {
                listener = "on" + listener; }
            elem.attachEvent(listener,func);
        } else if (elem === window) {
            document.addEventListener(listener, func, useCapture);
        }
        return elem;
    }

    addListener(null,'load',loadImages);
}

mtgExplorerGetImages();