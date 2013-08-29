ko.bindingHandlers.modalVis = {
	init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        var showon = $(element).data("showon")
        if (value () == showon){
        	$(element).modal('show');
        } else {
        	$(element).modal('hide')
        }
    }
};