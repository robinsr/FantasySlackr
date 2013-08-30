ko.observable.fn.subscribeAjaxIcons = function(type,cb){
    this.subscribe(function(value){
        cb('loading')
        var obj = {
            type: type,
            value: value
        }
        console.log('sending issue')
        utils.issue("method/checkValue",obj,function(err,stat,text){
            if (stat == 200){
                cb('verified');
            } else if (stat == 400) {
                cb('rejected');
            } else {
                cb('');
            }
        })
    });
}
ko.observable.fn.subscribeCheckPass = function(cb){
    this.subscribe(function(value){
        if (value.length > 8) {
            cb('verified');
        } else {
            cb ('rejected');
        }
    })
}
ko.bindingHandlers.modalVis = {
	init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        var showon = $(element).data("showon")
        if (value() == showon){
        	$(element).modal('show');
        } else {
        	$(element).modal('hide')
        }
    }
};
ko.bindingHandlers.formShake = {
    init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        var showon = $(element).data("shakeon")
        if (value() == showon){
            $(element).shake()
        } 
    }
};
ko.bindingHandlers.ajaxIcons = {
    init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        console.log(value());
        $(element).removeClass('loading').removeClass('verified').removeClass('rejected');
        if (value() != '') {
            $(element).addClass(value());
        }
    }
};
