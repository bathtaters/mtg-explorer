function mtgExplorerButtons() {
    function fetchSets() {
        // var elem = event.target || event.srcElemnt || event;
        // console.debug("checking sets");
        var setList = document.getElementById('sets').value;

        return fetch('./sets', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sets: setList })
            })
            .then(function(response) { return response.json(); })
            .then(function(response) {
                // console.debug("Response:",response);
                if (!response.invalid) {
                    console.error('Error checking sets: ',response);
                } else if (response.invalid.length) {
                    document.getElementById('setResults').innerText = 'Invalid sets: ' + response.invalid.join(', ');
                } else {
                    document.getElementById('setResults').innerText = 'All sets are valid!';
                }
            });
    }

    function setupListeners() {
        addListener(
            document.getElementById('checkSets'),
            'click', fetchSets, true
        );
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

    addListener(null,'load',setupListeners);
}

mtgExplorerButtons();