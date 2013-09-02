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
        $(element).removeClass('loading').removeClass('verified').removeClass('rejected');
        if (value() != '') {
            $(element).addClass(value());
        }
    }
};
ko.bindingHandlers.changeSetting = {
    init: function(element, valueAccessor){
        var value = valueAccessor()
        $(element).change(function(){
            console.log(value())
            value(this.value);
            console.log(value())
        })
    },
    update: function(element, valueAccessor){
        var value = valueAccessor()
        $(element).val(value());
    }
}
ko.bindingHandlers.accordianClick = {
    init: function(element, valueAccessor){
        var value = valueAccessor();
        $(element).click(function(){
            var select = "#" + value;
            console.log(value);
            $(select).collapse();
            console.log($(select))
        })
    },
    update: function(element, valueAccessor){
        var value = valueAccessor()
        $(element).val(value());
    }
}
ko.bindingHandlers.startOrBench = {
    init: function(element, valueAccessor){
        var value = valueAccessor();
        $(element).click(function(){
            var button = $(this).text();
            if (button == "Start"){
                value.selected_position(value.position);
            } else if (button == "Bench") {
                value.selected_position("BN");
            }
        })
    },
    update: function(element, valueAccessor){
        console.log()
        var value = valueAccessor();
        if ((value.selected_position() == "BN") && ($(element).text() == "Bench")){
            $(element).addClass("btn-primary");
        } else if ((value.selected_position() != "BN") && ($(element).text() != "Bench")){
            $(element).addClass("btn-primary");
        } else {
            $(element).removeClass("btn-primary");
        }
    }
}