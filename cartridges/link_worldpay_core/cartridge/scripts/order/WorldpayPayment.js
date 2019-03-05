'use strict';

var ArrayList = require('dw/util/ArrayList');
var Logger = require('dw/system/Logger');
var URLUtils = require('dw/web/URLUtils');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var PaymentInstrumentUtils = require('link_worldpay_core/cartridge/scripts/common/PaymentInstrumentUtils');
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var WorldpayConstants = require('link_worldpay_core/cartridge/scripts/common/WorldpayConstants');
var StringUtils = require('dw/util/StringUtils');
var ServiceFacade = require('link_worldpay_core/cartridge/scripts/service/ServiceFacade');
/**
 * Verifies selected payment card redirect form fields information is a valid. If the information is valid payment instrument is created.
 * @param {dw.order.Basket} basket - Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @return {Object} returns an error object
 */
function handleCardRedirect(basket, paymentInformation) {
    var Site = require('dw/system/Site');

    var paymentInstrument;
    var paymentMethod = paymentInformation.selectedPaymentMethodID.value;
    var cardNumber = paymentInformation.cardNumber.value;
    if (paymentMethod.equals(WorldpayConstants.WORLDPAY) && Site.getCurrent().getCustomPreferenceValue('WorldpayEnableTokenization') && basket.getCustomer().authenticated
        && cardNumber) {
        var expirationMonth = paymentInformation.expirationMonth.value;
        var expirationYear = paymentInformation.expirationYear.value;
        var holderName = paymentInformation.cardOwner.value;
        var cardType = paymentInformation.cardType.value;
        var wallet = basket.getCustomer().getProfile().getWallet();
        var paymentInstruments = wallet.getPaymentInstruments(PaymentInstrument.METHOD_CREDIT_CARD);
        var matchedPaymentInstrument = require('link_worldpay_core/cartridge/scripts/common/PaymentInstrumentUtils').getTokenPaymentInstrument(paymentInstruments, cardNumber, cardType, expirationMonth, expirationYear);
        if (matchedPaymentInstrument && matchedPaymentInstrument.getCreditCardToken()) {
            var tokenId = matchedPaymentInstrument.getCreditCardToken();

            Transaction.wrap(function () {
                PaymentInstrumentUtils.removeExistingPaymentInstruments(basket);

                paymentInstrument = basket.createPaymentInstrument(
                    tokenId ? WorldpayConstants.CREDITCARD : paymentMethod, paymentInformation.paymentPrice
                );

                paymentInstrument.setCreditCardHolder(holderName);
                paymentInstrument.setCreditCardNumber(cardNumber);
                paymentInstrument.setCreditCardType(cardType);
                paymentInstrument.setCreditCardExpirationMonth(expirationMonth);
                paymentInstrument.setCreditCardExpirationYear(expirationYear);
                paymentInstrument.custom.WorldpayMID = Site.getCurrent().getCustomPreferenceValue('WorldpayMerchantCode');
                if (tokenId) {
                    paymentInstrument.creditCardToken = tokenId;
                } else if (paymentInformation.saveCard.value && Site.getCurrent().getCustomPreferenceValue('WorldpayEnableTokenization')) {
                    paymentInstrument.custom.wpTokenRequested = true;
                }
                paymentInstrument.custom.cpf = paymentInformation.brazilFields.cpf.value;
                if (paymentInformation.brazilFields.installments.value) {
                    paymentInstrument.custom.installments = paymentInformation.brazilFields.installments.value;
                }
            });
            return { fieldErrors: {}, serverErrors: {}, error: false, success: true, ccCvn: paymentInformation.securityCode.value, PaymentInstrument: paymentInstrument };
        }
    }
    Transaction.wrap(function () {
        PaymentInstrumentUtils.removeExistingPaymentInstruments(basket);
        paymentInstrument = basket.createPaymentInstrument(paymentMethod, paymentInformation.paymentPrice);
        if (paymentMethod.equals(WorldpayConstants.WORLDPAY) && paymentInformation.saveCard
                && paymentInformation.saveCard.value
                && Site.getCurrent().getCustomPreferenceValue('WorldpayEnableTokenization')
                && basket.getCustomer().authenticated) {
            paymentInstrument.custom.wpTokenRequested = true;
        }
        if (paymentInformation.preferredCard.value) {
            paymentInstrument.custom.worldpayPreferredCard = paymentInformation.preferredCard.value;
        }
        paymentInstrument.custom.cpf = paymentInformation.brazilFields.cpf.value;
        if (paymentInformation.brazilFields.installments.value) {
            paymentInstrument.custom.installments = paymentInformation.brazilFields.installments.value;
        }
    });
    return { fieldErrors: {}, serverErrors: {}, error: false, success: true, ccCvn: '', PaymentInstrument: paymentInstrument };
}

/**
 * Verifies selected payment APM with their form fields information is a valid. If the information is valid payment instrument is created.
 * @param {dw.order.Basket} basket - Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @return {Object} returns an error object
 */
function handleAPM(basket, paymentInformation) {
    var Site = require('dw/system/Site');

    var paymentInstrument;
    var fieldErrors = {};
    var serverErrors = [];
    var paymentMethod = paymentInformation.selectedPaymentMethodID.value;
    Transaction.wrap(function () {
        PaymentInstrumentUtils.removeExistingPaymentInstruments(basket);
        paymentInstrument = basket.createPaymentInstrument(
            paymentMethod, paymentInformation.paymentPrice
        );
        if (paymentMethod.equals(WorldpayConstants.IDEAL)) {
            paymentInstrument.custom.bank = paymentInformation.idealFields.bank.value;
        } else if (paymentMethod.equals(WorldpayConstants.BOLETO)) {
            paymentInstrument.custom.cpf = paymentInformation.brazilFields.cpf.value;
//            paymentInstrument.custom.installments = paymentInformation.brazilFields.installments.value;
        } else if (paymentMethod.equals(WorldpayConstants.GIROPAY)) {
            paymentInstrument.custom.bankCode = paymentInformation.giropayFields.bankCode.value;
        } else if (paymentMethod.equals(WorldpayConstants.ELV)) {
            paymentInstrument.custom.elvMandateType = paymentInformation.elvFields.elvMandateType.value;
            paymentInstrument.custom.elvMandateID = paymentInformation.elvFields.elvMandateID.value;
            paymentInstrument.custom.iban = paymentInformation.elvFields.iban.value;
            paymentInstrument.custom.accountHolderName = paymentInformation.elvFields.accountHolderName.value;
            // paymentInstrument.custom.bankName = paymentInformation.elvFields.bankName.value;
            // paymentInstrument.custom.bankLocation = paymentInformation.elvFields.bankLocation.value;
        }
        paymentInstrument.custom.WorldpayMID = Site.getCurrent().getCustomPreferenceValue('WorldpayMerchantCode');
    });
    return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: false, success: true };
}

/**
 * Verifies that entered credit card information is a valid card. If the information is valid a
 * credit card payment instrument is created
 * @param {dw.order.Basket} basket - Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @return {Object} returns an error object
 */
function handleCreditCard(basket, paymentInformation) {
    var currentBasket = basket;
    var Site = require('dw/system/Site');

    Transaction.wrap(function () {
        PaymentInstrumentUtils.removeExistingPaymentInstruments(currentBasket);

        var paymentInstrument = currentBasket.createPaymentInstrument(
            PaymentInstrument.METHOD_CREDIT_CARD, paymentInformation.paymentPrice
        );
        var cardNumber = paymentInformation.cardNumber.value;
        var expirationMonth = paymentInformation.expirationMonth.value;
        var expirationYear = paymentInformation.expirationYear.value;
        var holderName = paymentInformation.cardOwner.value;
        var cardType = paymentInformation.cardType.value;
        paymentInstrument.setCreditCardHolder(holderName);
        paymentInstrument.setCreditCardNumber(cardNumber);
        paymentInstrument.setCreditCardType(cardType);
        paymentInstrument.setCreditCardExpirationMonth(expirationMonth);
        paymentInstrument.setCreditCardExpirationYear(expirationYear);
        paymentInstrument.custom.WorldpayMID = Site.getCurrent().getCustomPreferenceValue('WorldpayMerchantCode');
        if (paymentInformation.creditCardToken && !paymentInformation.creditCardToken.empty) {
            paymentInstrument.creditCardToken = paymentInformation.creditCardToken;
        } else if (paymentInformation.saveCard && paymentInformation.saveCard.value && Site.getCurrent().getCustomPreferenceValue('WorldpayEnableTokenization')) {
            paymentInstrument.custom.wpTokenRequested = true;
        }
        paymentInstrument.custom.cpf = paymentInformation.brazilFields.cpf.value;
        if (paymentInformation.brazilFields.installments.value) {
            paymentInstrument.custom.installments = paymentInformation.brazilFields.installments.value;
        }
    });

    return { fieldErrors: {}, serverErrors: {}, error: false, success: true };
}


/**
 * Authorizes a payment using a credit card. Customizations may use other processors and custom
 *      logic to authorize credit card payment.
 * @param {number} orderNumber - The current order's number
 * @param {string} cardNumber -  cardNumber.
 * @param {string} encryptedData - encryptedData
 * @param {string} cvn - cvn
 * @return {Object} returns an error object
 */
function authorize(orderNumber, cardNumber, encryptedData, cvn) {
    var OrderMgr = require('dw/order/OrderMgr');
    var WorldpayPreferences = require('link_worldpay_core/cartridge/scripts/object/WorldpayPreferences');
    var Resource = require('dw/web/Resource');
    var serverErrors = [];
    var fieldErrors = {};

    // fetch order object
    var order = OrderMgr.getOrder(orderNumber);
    // fetch the APM Name or payment method name from the Payment instrument.
    var apmName;
    var paymentMthd;
    var preferences;
    // initialize worldpay preferences
    var worldPayPreferences = new WorldpayPreferences();

    // order not found
    if (!order) {
        Logger.getLogger('worldpay').error('authorize : Invalid Order');
        serverErrors.push(Resource.msg('error.technical', 'checkout', null));
        return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: true };
    }
    var pi;
    var paymentInstruments = order.getPaymentInstruments();
    if (paymentInstruments.length > 0) {
        Transaction.wrap(function () {
            for (var i = 0; i < paymentInstruments.length; i++) {
                pi = paymentInstruments[i];
                var payProcessor = PaymentMgr.getPaymentMethod(pi.getPaymentMethod()).getPaymentProcessor();
                if (payProcessor != null && payProcessor.getID().equalsIgnoreCase(WorldpayConstants.WORLDPAY)) {
                    // update payment instrument with transaction basic attrubutes
                    apmName = pi.getPaymentMethod();
                    paymentMthd = PaymentMgr.getPaymentMethod(apmName);
                    preferences = worldPayPreferences.worldPayPreferencesInit(paymentMthd);
                    pi.paymentTransaction.transactionID = orderNumber;
                    pi.paymentTransaction.paymentProcessor = payProcessor;
                    pi.custom.WorldpayMID = preferences.merchantCode;
                    break;
                }
            }
        });
    }

    // credit card direct APM authorization flow
    if (pi.paymentMethod.equals(PaymentInstrument.METHOD_CREDIT_CARD) || (pi.paymentMethod.equals(WorldpayConstants.WORLDPAY) && pi.getCreditCardToken())) {
        // Auth service call
        var CCAuthorizeRequestResult = ServiceFacade.ccAuthorizeRequestService(order, request, pi, preferences, cardNumber, encryptedData, cvn);// eslint-disable-line

        if (CCAuthorizeRequestResult.error) {
            Logger.getLogger('worldpay').error('Worldpyay helper SendCCAuthorizeRequest : ErrorCode : ' + CCAuthorizeRequestResult.errorCode + ' : Error Message : ' + CCAuthorizeRequestResult.errorMessage);
            serverErrors.push(CCAuthorizeRequestResult.errorMessage);
            return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: true, errorCode: CCAuthorizeRequestResult.errorCode, errorMessage: CCAuthorizeRequestResult.errorMessage };
        }

        var serviceResponse = CCAuthorizeRequestResult.serviceresponse;
    // save token details in order object
        Transaction.wrap(function () {
            PaymentInstrumentUtils.updatePaymentInstrumentToken(serviceResponse, pi);
        });

        if (serviceResponse.is3DSecure) {
            Transaction.wrap(function () {
                pi.custom.resHeader = CCAuthorizeRequestResult.responseObject.responseHeader;
            });
            return {
                is3D: true,
                redirectUrl: serviceResponse.issuerURL,
                paRequest: serviceResponse.paRequest,
                termUrl: preferences.getTermURL().toString(),
                echoData: serviceResponse.echoData
            };
        }
        var customerObj = order.customer.authenticated ? order.customer : null;
        var TokenProcessUtils = require('link_worldpay_core/cartridge/scripts/common/TokenProcessUtils');
        return TokenProcessUtils.checkAuthorization(serviceResponse, pi, customerObj);
    }
    var Utils = require('link_worldpay_core/cartridge/scripts/common/Utils');
    var countryCode = order.getBillingAddress().countryCode;
        // req.session.privacyCache.set('order_id', order.orderNo);
    var apmType = paymentMthd.custom.type.toString();
    var isValidCustomOptionsHPP = false;
    var responsePaymentMethod;
    var redirectURL = '';
    var orderamount = Utils.calculateNonGiftCertificateAmount(order);

    // if Klarna then adjustedMerchandizeTotalPrice
    if (apmName.equals(WorldpayConstants.KLARNA)) {
        orderamount = order.adjustedMerchandizeTotalPrice.add(order.adjustedShippingTotalPrice);
    }
    var authorizeOrderResult = ServiceFacade.authorizeOrderService(orderamount, order, pi, order.customer, paymentMthd);
    if (authorizeOrderResult.error) {
        Logger.getLogger('worldpay').error('AuthorizeOrder.js : ErrorCode : ' + authorizeOrderResult.errorCode + ' : Error Message : ' + authorizeOrderResult.errorMessage);
        serverErrors.push(authorizeOrderResult.errorMessage);
        return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: true, errorCode: authorizeOrderResult.errorCode, errorMessage: authorizeOrderResult.errorMessage };
    }

    if (apmName.equals(WorldpayConstants.ELV)) {
        Transaction.wrap(function () {
            order.custom.mandateID = pi.custom.elvMandateID;
        });
        redirectURL = URLUtils.https('COPlaceOrder-Submit', 'order_id', order.orderNo, WorldpayConstants.ORDERTOKEN, order.orderToken, WorldpayConstants.PAYMENTSTATUS, WorldpayConstants.PENDING, WorldpayConstants.APMNAME, apmName).toString();
    } else if (apmName.equals(WorldpayConstants.WECHATPAY) && apmType.equalsIgnoreCase(WorldpayConstants.DIRECT)) {
        Transaction.wrap(function () {
            pi.custom.wpWechatQRCode = authorizeOrderResult.response.qrCode; //eslint-disable-line
        });
        redirectURL = URLUtils.https('COPlaceOrder-Submit', 'order_id', order.orderNo, WorldpayConstants.ORDERTOKEN, order.orderToken, WorldpayConstants.PAYMENTSTATUS, WorldpayConstants.PENDING, WorldpayConstants.APMNAME, apmName).toString();
    } else if (authorizeOrderResult.response.reference) {
        redirectURL = authorizeOrderResult.response.reference.toString();

        if (paymentMthd.custom.wordlpayHPPCustomOptionsJSON && Utils.isValidCustomOptionsHPP(paymentMthd)) {
            isValidCustomOptionsHPP = true;
        }

        responsePaymentMethod = authorizeOrderResult.response.paymentMethod.toString();
        if (responsePaymentMethod && !responsePaymentMethod.equals(WorldpayConstants.KLARNA) && redirectURL.indexOf('&amp;') > 0) {
            redirectURL = redirectURL.replace('&amp;', '&');
        }

        // if (responsePaymentMethod && !responsePaymentMethod.equals(WorldpayConstants.KLARNA) && !isValidCustomOptionsHPP) {
        if (undefined === responsePaymentMethod || !responsePaymentMethod.equals(WorldpayConstants.KLARNA)) {
            if (!isValidCustomOptionsHPP) {
                if (apmType.equalsIgnoreCase(WorldpayConstants.DIRECT)) {
                    redirectURL = Utils.createDirectURL(redirectURL, order.orderNo, countryCode);
                } else {
                    redirectURL = Utils.createRedirectURL(apmName, redirectURL, order.orderNo, countryCode, order.orderToken);
                }
            } else {
                Transaction.wrap(function () {
                    pi.custom.worldpayRedirectURL = redirectURL;
                });
            }
            if (apmName.equals(WorldpayConstants.WECHATPAY)) {
               // Intermediate redirection to remove id and token concatenating from checkout.js javascript
                Transaction.wrap(function () {
                    pi.custom.worldpayRedirectURL = redirectURL;
                });
                redirectURL = URLUtils.https('Worldpay-Wechatredirect', 'order_id', order.orderNo).toString();
            }
        }
    } else if (undefined === authorizeOrderResult.response.reference) {
        Logger.getLogger('worldpay').error('AuthorizeOrder.js : ErrorCode : ' + authorizeOrderResult.errorCode + ' : Last Event : ' + authorizeOrderResult.response.lastEvent);
        serverErrors.push(Utils.getErrorMessage());
        return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: true };
    }
    if (pi.paymentMethod.equals(WorldpayConstants.KONBINI)) {
        Transaction.wrap(function () {
            pi.custom.wpKonbiniPaymentReference = redirectURL;
        });
        return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: false, redirectUrlKonbini: redirectURL, authorized: true, isPaymentKonbini: true, redirectUrl: redirectURL };
    } else if (isValidCustomOptionsHPP) {
        return {
            redirect: true,
            redirectUrl: redirectURL,
            isValidCustomOptionsHPP: isValidCustomOptionsHPP,
            returnToPage: true,
            customOptionsHPPJSON: Utils.getCustomOptionsHPP(paymentMthd, redirectURL, order.orderNo, order.getOrderToken(), null)
        };
    } else if (responsePaymentMethod && responsePaymentMethod.equals(WorldpayConstants.KLARNA)) {
        redirectURL = StringUtils.decodeString(StringUtils.decodeBase64(redirectURL), StringUtils.ENCODE_TYPE_HTML);
        redirectURL = redirectURL.replace('window.location.href', 'window.top.location.href');
        return {
            redirect: true,
            redirectUrl: '',
            isKlarna: true,
            klarnasnippet: redirectURL,
            returnToPage: true
        };
    }
    if (apmName.equals(WorldpayConstants.WORLDPAY) || apmName.equals(WorldpayConstants.CHINAUNIONPAY) || apmName.equals(WorldpayConstants.ENETSSSL)) {
        return {
            worldpayredirect: true,
            redirectUrl: redirectURL
        };
    }
    return {
        redirect: true,
        redirectUrl: redirectURL
    };
}

/**
 * Update Token in payment Instrument for customer save payent instrument
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to update token
 * @param {dw.customer.Customer} customer -  The customer where the token value to preseve in saved cards
 * @return {Object} returns an error object
 */
function updateToken(paymentInstrument, customer) {
    var cardNumber = paymentInstrument.getCreditCardNumber();
    var cardType = paymentInstrument.getCreditCardType();
    var expirationMonth = paymentInstrument.getCreditCardExpirationMonth();
    var expirationYear = paymentInstrument.getCreditCardExpirationYear();
    if (customer && customer.authenticated) {
        var wallet = customer.getProfile().getWallet();
        var customerPaymentInstruments = wallet.paymentInstruments;
        try {
       // find credit card in payment instruments
            var creditCardInstrument = PaymentInstrumentUtils.getTokenPaymentInstrument(customerPaymentInstruments, cardNumber, cardType, expirationMonth, expirationYear);
            if (!creditCardInstrument.empty) {
                Transaction.wrap(function () {
                    wallet.removePaymentInstrument(creditCardInstrument);
                    if (!creditCardInstrument.getCreditCardToken().empty) {
                        paymentInstrument.setCreditCardToken(creditCardInstrument.getCreditCardToken());
                    }
                });
            }
        } catch (ex) {
            Logger.getLogger('worldpay').error('worldpay-UpdateToken error recieved : ' + ex.message);
        }
    }
    return {};
}

/**
 * Creates an array of objects containing applicable payment methods
 * @param {dw.util.ArrayList<dw.order.dw.order.PaymentMethod>} paymentMethods - An ArrayList of
 *      applicable payment methods that the user could use for the current basket.
 * @param {string} countryCode - the associated apm countryCode
 * @param {Object} preferences - the associated worldpay preferences
 * @returns {Array} of object that contain information about the applicable payment methods for the
 *      current cart
 */
function applicablePaymentMethods(paymentMethods, countryCode, preferences) {
    var Utils = require('*/cartridge/scripts/common/Utils');
    var APMLookupServiceResult;
    var enableAPMLookUpService = preferences.enableAPMLookUpService;
    var applicableAPMs = new ArrayList();
    var APMLookupServicePmtMtds;
    // get page url action
    var pageaction;
    var req = request; //eslint-disable-line
    var requestpath = req.getHttpPath();
    if (requestpath) {
        var action = requestpath.split('/');
        pageaction = action[action.length - 1];
    }
    if (enableAPMLookUpService && pageaction !== 'Order-History') {
        APMLookupServiceResult = ServiceFacade.apmLookupService(countryCode);
        APMLookupServicePmtMtds = (undefined !== APMLookupServiceResult && undefined !== APMLookupServiceResult.apmList) ? APMLookupServiceResult.apmList : new ArrayList();
        var iterator = paymentMethods.iterator();
        var item = null;
        while (iterator.hasNext()) {
            item = iterator.next();
            var itemId = item.ID;
            if (item.paymentProcessor && !WorldpayConstants.WORLDPAY.equals(item.paymentProcessor.ID)) {
                applicableAPMs.push(item);
            } else if (item.custom.merchantID && !item.custom.merchantID.equalsIgnoreCase(preferences.merchantCode)) {
                applicableAPMs.push(item);
            } else if (APMLookupServicePmtMtds.contains(itemId) && itemId.equalsIgnoreCase(WorldpayConstants.IDEAL) && preferences.worldPayIdealBankList) {
                applicableAPMs.push(item);
            } else if (APMLookupServicePmtMtds.contains(itemId) && (itemId.equalsIgnoreCase(WorldpayConstants.WECHATPAY) && (Utils.isDesktopDevice()))) {
                applicableAPMs.push(item);
            } else if (APMLookupServicePmtMtds.contains(itemId) && !itemId.equalsIgnoreCase(WorldpayConstants.NORDEAFI) && !itemId.equalsIgnoreCase(WorldpayConstants.NORDEASE) && !itemId.equalsIgnoreCase(WorldpayConstants.IDEAL) && !itemId.equalsIgnoreCase(WorldpayConstants.WECHATPAY)) {
                applicableAPMs.push(item);
            }
        }

        var creditCardPmtMtd = PaymentMgr.getPaymentMethod(WorldpayConstants.CREDITCARD);
        if (creditCardPmtMtd != null && creditCardPmtMtd.active && creditCardPmtMtd.paymentProcessor && WorldpayConstants.WORLDPAY.equals(creditCardPmtMtd.paymentProcessor.ID)) {
            applicableAPMs.push(creditCardPmtMtd);
        }
        var creditCardPmtMtdWorldpay = PaymentMgr.getPaymentMethod(WorldpayConstants.WORLDPAY);
        if (creditCardPmtMtdWorldpay != null && creditCardPmtMtdWorldpay.active && creditCardPmtMtdWorldpay.paymentProcessor && WorldpayConstants.WORLDPAY.equals(creditCardPmtMtdWorldpay.paymentProcessor.ID)) {
            applicableAPMs.push(creditCardPmtMtdWorldpay);
        }
    }
    return { applicableAPMs: applicableAPMs };
}

exports.updateToken = updateToken;
exports.handleAPM = handleAPM;
exports.handleCardRedirect = handleCardRedirect;
exports.handleCreditCard = handleCreditCard;
exports.authorize = authorize;
exports.applicablePaymentMethods = applicablePaymentMethods;
