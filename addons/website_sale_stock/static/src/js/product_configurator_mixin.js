odoo.define('website_sale_stock.ProductConfiguratorMixin', function (require) {
'use strict';

var ProductConfiguratorMixin = require('sale.ProductConfiguratorMixin');
var sAnimations = require('website.content.snippets.animation');
var ajax = require('web.ajax');
var core = require('web.core');
var QWeb = core.qweb;
var xml_load = ajax.loadXML(
    '/website_sale_stock/static/src/xml/website_sale_stock_product_availability.xml',
    QWeb
);

const DAYS = [
    ['Sunday', 'dimanche'],
    ['Monday', 'lundi'],
    ['Tuesday', 'mardi'],
    ['Wednesday', 'mercredi'],
    ['Thursday', 'jeudi'],
    ['Friday', 'vendredi'],
    ['Saturday', 'samedi']
]
const JOURS_FERIES = ['2020-05-25', '2020-07-30', '2020-07-31', '2020-08-20',
    '2020-10-29', '2020-11-06', '2021-01-01']

const DEMAIN = ['tomorrow', 'demain']
const AUJOURDHUI = ['today', 'aujourd\'hui']
const LANG = {'en-US':0, 'fr-FR':1}

/**
 * Addition to the product_configurator_mixin._onChangeCombination
 *
 * This will prevent the user from selecting a quantity that is not available in the
 * stock for that product.
 *
 * It will also display various info/warning messages regarding the select product's stock.
 *
 * This behavior is only applied for the web shop (and not on the SO form)
 * and only for the main product.
 *
 * @param {MouseEvent} ev
 * @param {$.Element} $parent
 * @param {Array} combination
 */
ProductConfiguratorMixin._onChangeCombinationStock = function (ev, $parent, combination) {
    var product_id = 0;
    // needed for list view of variants
    if ($parent.find('input.product_id:checked').length) {
        product_id = $parent.find('input.product_id:checked').val();
    } else {
        product_id = $parent.find('.product_id').val();
    }
    var isMainProduct = combination.product_id &&
        ($parent.is('.js_main_product') || $parent.is('.main_product')) &&
        combination.product_id === parseInt(product_id);

    if (!this.isWebsite || !isMainProduct){
        return;
    }

    var qty = $parent.find('input[name="add_qty"]').val();

    $parent.find('#add_to_cart').removeClass('out_of_stock');
    if (combination.product_type === 'product' && _.contains(['always', 'threshold'], combination.inventory_availability)) {
        combination.qty_real -= parseInt(combination.cart_qty);
        if (combination.qty_real < 0) {
            combination.qty_real = 0;
        }
        // Handle case when manually write in input
        if (qty > combination.qty_real) {
            var $input_add_qty = $parent.find('input[name="add_qty"]');
            qty = combination.qty_real || 1;
            $input_add_qty.val(qty);
        }
        if (qty > combination.qty_real
            || combination.qty_real < 1 || qty < 1) {
            $parent.find('#add_to_cart').addClass('disabled out_of_stock');
        }
    }

    var addBusinessDays = function(start_date, added_days) {
        var days_elapsed = 0
        while (days_elapsed < added_days){
            start_date.setDate(start_date.getDate()+1)
            if (start_date.getDay()==0 || JOURS_FERIES.includes(start_date.toISOString().slice(0,10))){
                 // if a weekend or federal holiday, skip
                continue
            }
            else{
                // if a workday, count as a day
                days_elapsed += 1
            }
        }
        return start_date
    }

    xml_load.then(function () {
        $('.oe_website_sale')
            .find('.availability_message_' + combination.product_template)
            .remove();
        var $message = $(QWeb.render(
            'website_sale_stock.product_availability',
            combination
        ));
        $('div.availability_messages').html($message);

        $('.oe_website_sale')
            .find('.seller_messages' + combination.product_template)
            .remove();
        var $message = $(QWeb.render(
            'website_sale_stock.seller_message',
            combination
        ));
        $('div.seller_messages').html($message);

        if (combination["qty_real"]>0){

            var limit_date_for_today_express_delivery = new Date()
            limit_date_for_today_express_delivery.setHours(14,0,0)

            var limit_date_for_today_normal_delivery = new Date()
            limit_date_for_today_normal_delivery.setHours(23, 0, 0)

            var now = new Date();

            var express_delivery_date = new Date()
            if (now.getDay() === 0 || now > limit_date_for_today_express_delivery || JOURS_FERIES.includes(now.toISOString().slice(0,10))) {
                express_delivery_date = addBusinessDays(express_delivery_date, 1)
            }

            if (now > limit_date_for_today_normal_delivery || now.getDay() == 0 ) {
                var amana_expected_delivery_date = addBusinessDays(new Date(), 3)
            }else{
                var amana_expected_delivery_date = addBusinessDays(new Date(), 2)
            }

            var langue = $('html').attr('lang')
            combination["amana_expected_delivery_date"] = DAYS[amana_expected_delivery_date.getDay()][LANG[langue]]
            if (express_delivery_date.getDay()==now.getDay()){
                combination["express_delivery_date"] = AUJOURDHUI[LANG[langue]]
            }else if(express_delivery_date.getDay() == now.getDay()+1 ){
                combination["express_delivery_date"] = DEMAIN[LANG[langue]]
            }else{
                combination["express_delivery_date"] = DAYS[express_delivery_date.getDay()][LANG[langue]]
            }
        }
        $('.oe_website_sale')
                .find('.delivery_messages' + combination.product_template)
                .remove();
            var $message = $(QWeb.render(
                'website_sale_stock.delivery_message',
                combination
            ));
            $('div.delivery_messages').html($message);
    });
};

sAnimations.registry.WebsiteSale.include({
    /**
     * Adds the stock checking to the regular _onChangeCombination method
     * @override
     */
    _onChangeCombination: function (){
        this._super.apply(this, arguments);
        ProductConfiguratorMixin._onChangeCombinationStock.apply(this, arguments);
    }
});

return ProductConfiguratorMixin;

});
