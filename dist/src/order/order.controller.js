"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const order_service_1 = require("./order.service");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const users_model_1 = require("../users/users.model");
const order_model_1 = require("./order.model");
const app_model_1 = require("../utils/app.model");
const util_service_1 = require("../utils/util.service");
const wallet_service_1 = require("../wallet/wallet.service");
const wallet_model_1 = require("../wallet/wallet.model");
const app_gateway_1 = require("../app.gateway");
const products_service_1 = require("../products/products.service");
const cart_service_1 = require("../cart/cart.service");
const address_service_1 = require("../address/address.service");
const settings_service_1 = require("../settings/settings.service");
const sequence_service_1 = require("../sequence/sequence.service");
const users_service_1 = require("../users/users.service");
const settings_model_1 = require("../settings/settings.model");
const notifications_model_1 = require("../notifications/notifications.model");
const notifications_service_1 = require("../notifications/notifications.service");
const push_service_1 = require("../utils/push.service");
const stripe_service_1 = require("../utils/stripe.service");
const categories_service_1 = require("../categories/categories.service");
const jwt_strategy_1 = require("../utils/jwt.strategy");
const email_service_1 = require("../utils/email.service");
const business_service_1 = require("../business/business.service");
const product_out_of_stock_service_1 = require("../product-out-of-stock/product-out-of-stock.service");
const delivery_boy_ratings_service_1 = require("../delivery-boy-ratings/delivery-boy-ratings.service");
let OrderController = class OrderController {
    constructor(orderService, utilService, cartService, walletService, addressService, settingService, productService, categoryService, sequenceService, userService, notificationService, pushService, stripeService, emailService, socketService, businessService, productOutOfStockService, deliveryBoyRatingsService) {
        this.orderService = orderService;
        this.utilService = utilService;
        this.cartService = cartService;
        this.walletService = walletService;
        this.addressService = addressService;
        this.settingService = settingService;
        this.productService = productService;
        this.categoryService = categoryService;
        this.sequenceService = sequenceService;
        this.userService = userService;
        this.notificationService = notificationService;
        this.pushService = pushService;
        this.stripeService = stripeService;
        this.emailService = emailService;
        this.socketService = socketService;
        this.businessService = businessService;
        this.productOutOfStockService = productOutOfStockService;
        this.deliveryBoyRatingsService = deliveryBoyRatingsService;
    }
    async GetOrderListForUser(user, userQuery) {
        this.utilService.validateUserRole(user);
        try {
            let pagination = this.utilService.getUserPagination(userQuery);
            const orders = await Promise.all([
                this.orderService.getAllOrderForUser(user._id, pagination.page, pagination.limit),
                this.orderService.countAllOrderForUser(user._id)
            ]);
            return this.utilService.successResponseData(orders[0], { total: orders[1] });
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async getOrderDetailForUser(user, orderId) {
        this.utilService.validateUserRole(user);
        try {
            let order = await this.orderService.getOrderDetailForUser(user._id, orderId);
            if (!order)
                this.utilService.pageNotFound();
            let cart = await this.cartService.getCartById(order.cartId);
            const ratings = await this.cartService.findProductsById(user._id, cart.productIds);
            cart = JSON.parse(JSON.stringify(cart));
            cart.products.map(p => {
                const pro = ratings.find(r => r.productId == p.productId);
                if (pro) {
                    p.isRated = pro.isRated;
                    p.rating = pro.rating;
                }
            });
            delete order.cartId;
            return this.utilService.successResponseData({ order: order, cart: cart });
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async placeOrder(userData, orderData) {
        this.utilService.validateUserRole(userData);
        try {
            if (!(orderData.paymentType == order_model_1.PaymentType.STRIPE || orderData.paymentType == order_model_1.PaymentType.COD || orderData.paymentType == order_model_1.PaymentType.MY_FATOORAH))
                orderData.paymentType = order_model_1.PaymentType.COD;
            if (orderData.paymentType === order_model_1.PaymentType.STRIPE && !orderData.paymentId)
                this.utilService.badRequest(app_model_1.ResponseMessage.PAYMENT_ID_NOT_FOUND);
            const userCart = await this.cartService.getCartByUserId(userData._id);
            if (!userCart)
                this.utilService.badRequest(app_model_1.ResponseMessage.CART_ITEM_NOT_FOUND);
            if (!userCart.deliveryAddress)
                this.utilService.badRequest(app_model_1.ResponseMessage.ADDRESS_NOT_FOUND);
            const settings = await this.settingService.getDeliveryTaxSettings();
            const userAdress = await this.addressService.getAddressDetail(userData._id, userCart.deliveryAddress);
            const storeLocation = { latitude: settings.location.latitude, longitude: settings.location.longitude };
            const userLocation = { latitude: userAdress.location.latitude, longitude: userAdress.location.longitude };
            const preciseDistance = this.utilService.calculateDistance(userLocation, storeLocation);
            if (preciseDistance > settings.deliveryCoverage)
                this.utilService.badRequest(app_model_1.ResponseMessage.ADDDRESS_DELIVERY_LOCATION_NOT_AVAILABLE);
            if (settings && userCart.subTotal < settings.minimumOrderAmountToPlaceOrder) {
                const resMsg = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.ORDER_MINIMUM_AMOUNT_PLACE_ORDER);
                this.utilService.badRequest(`${resMsg}` + settings.minimumOrderAmountToPlaceOrder);
            }
            const products = await this.productService.getProductByIds(userCart.productIds);
            const cartVerifyData = await this.cartService.verifyCart(products, userCart);
            if (cartVerifyData.cartArr.length > 0)
                this.utilService.badRequest(cartVerifyData.cartArr);
            if (userCart.walletAmount > 0) {
                if (userData.walletAmount < userCart.walletAmount)
                    this.utilService.badRequest(app_model_1.ResponseMessage.WALLET_INSUFFICENT_AMOUNT);
            }
            let order = {
                subTotal: 0,
                tax: 0,
                product: {
                    title: '',
                    imageUrl: ''
                },
                totalProduct: 0,
                grandTotal: 0,
                deliveryCharges: 0,
                couponCode: 0,
                couponAmount: 0,
                transactionDetails: {
                    transactionStatus: '',
                    receiptUrl: '',
                    transactionId: '',
                    currency: ''
                },
                address: null,
                user: null,
                userId: '',
                paymentType: '',
                orderStatus: '',
                paymentStatus: order_model_1.PaymentStatusType.PENDING,
                cartId: '',
                orderID: 0,
                deliveryDate: '',
                deliveryTime: '',
                isWalletUsed: false,
                usedWalletAmount: 0,
                amountRefunded: 0,
                currencySymbol: "",
                currencyCode: "",
                invoiceToken: '',
                orderFrom: orderData.orderFrom
            };
            if (!orderData.deliverySlotId)
                this.utilService.badRequest(app_model_1.ResponseMessage.DELIEVRY_SLOT_NOT_SELECTED);
            const deliveryTimeSlots = await this.settingService.getDeliveryTimeSlots();
            const availableSlots = await this.settingService.getAvailableTimeSlot(deliveryTimeSlots['deliveryTimeSlots']);
            let openSlots = [];
            availableSlots.map(day => {
                day.timings.map(time => { openSlots[time._id] = { date: day.date, slot: time.slot }; });
            });
            const selectedTimeslot = openSlots[orderData.deliverySlotId];
            if (!selectedTimeslot)
                this.utilService.badRequest(app_model_1.ResponseMessage.DELIEVRY_SLOT_NOT_AVAILABLE);
            order.deliveryDate = selectedTimeslot.date;
            order.deliveryTime = selectedTimeslot.slot;
            order.subTotal = userCart.subTotal;
            order.tax = userCart.tax;
            order.grandTotal = userCart.grandTotal;
            order.deliveryCharges = userCart.deliveryCharges;
            order.currencyCode = settings.currencyCode;
            order.currencySymbol = settings.currencySymbol;
            order.transactionDetails = {
                transactionStatus: null,
                receiptUrl: null,
                transactionId: null,
                currency: null
            };
            order.couponCode = userCart.couponCode;
            order.couponAmount = userCart.couponAmount;
            if (userCart.walletAmount) {
                order.usedWalletAmount = userCart.walletAmount;
                order.isWalletUsed = true;
                if (order.grandTotal === 0) {
                    order.paymentStatus = order_model_1.PaymentStatusType.SUCCESS;
                }
            }
            if (orderData.paymentType === order_model_1.PaymentType.STRIPE) {
                const amount = Math.round(Number(Number(order.grandTotal.toFixed(2)) * 100));
                if (orderData.orderFrom == order_model_1.PaymentFrom.WEB_APP) {
                    const charge = await this.stripeService.createChargePayment({
                        amount: amount,
                        currency: settings.currencyCode || "USD",
                        description: order_model_1.PaymentFrom.WEB_APP,
                        source: orderData.paymentId
                    });
                    if (charge && charge.status == order_model_1.StripePaymentStatus.SUCCESS) {
                        order.transactionDetails.transactionStatus = charge.status;
                        order.transactionDetails.receiptUrl = charge.receipt_url;
                        order.transactionDetails.transactionId = charge.id;
                        order.transactionDetails.currency = charge.currency;
                        order.paymentStatus = order_model_1.PaymentStatusType.SUCCESS;
                    }
                    else
                        this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_PAYMENT_ERROR);
                }
                else if (orderData.orderFrom == order_model_1.PaymentFrom.USER_APP) {
                    let paymentIntent = await this.stripeService.createPaymentIntents({
                        amount: amount,
                        currency: settings.currencyCode || "USD",
                        payment_method: orderData.paymentId,
                        capture_method: order_model_1.StripePaymentStatus.MANUAL,
                        confirm: true
                    });
                    if (paymentIntent && paymentIntent.id && paymentIntent.status == order_model_1.StripePaymentStatus.REQUIRES_CAPTURE) {
                        let capturedPay = await this.stripeService.capturePaymentIntents(paymentIntent.id, { amount_to_capture: amount });
                        if (capturedPay && capturedPay.status == order_model_1.StripePaymentStatus.SUCCESS) {
                            order.transactionDetails.transactionStatus = capturedPay.status;
                            order.transactionDetails.receiptUrl = capturedPay.charges.data[0].receipt_url;
                            order.transactionDetails.transactionId = capturedPay.charges.data[0].id;
                            order.transactionDetails.currency = capturedPay.currency;
                            order.paymentStatus = order_model_1.PaymentStatusType.SUCCESS;
                        }
                        else
                            this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_PAYMENT_ERROR);
                    }
                    else
                        this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_PAYMENT_ERROR);
                }
            }
            if (orderData.paymentType === order_model_1.PaymentType.MY_FATOORAH) {
                if (orderData.orderFrom == order_model_1.PaymentFrom.USER_APP) {
                    order.transactionDetails.transactionStatus = "SUCCESS";
                    order.transactionDetails.transactionId = orderData.paymentId;
                    order.transactionDetails.currency = "SAR";
                    order.paymentStatus = order_model_1.PaymentStatusType.SUCCESS;
                }
            }
            order.address = {
                address: userAdress.address,
                flatNo: userAdress.flatNo,
                postalCode: userAdress.postalCode,
                addressType: userAdress.addressType,
                apartmentName: userAdress.apartmentName,
                landmark: userAdress.landmark,
                location: userAdress.location
            };
            order.user = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                mobileNumber: userData.mobileNumber,
                email: userData.email,
                countryCode: userData.countryCode,
                countryName: userData.countryName
            };
            order.userId = userData._id;
            order.paymentType = orderData.paymentType;
            order.orderStatus = order_model_1.OrderStatusType.PENDING;
            order.cartId = userCart._id;
            order.totalProduct = userCart.products.length;
            order.product = {
                title: userCart.products[0].productName,
                imageUrl: userCart.products[0].imageUrl
            };
            order.invoiceToken = await this.utilService.getUUID();
            let sequence = await this.sequenceService.getSequence();
            order.orderID = sequence ? sequence.sequenceNo : Math.floor(900000 * Math.random()) + 100000;
            const orderRes = await this.orderService.createOrder(order);
            if (orderRes) {
                if (cartVerifyData && cartVerifyData.productArr.length) {
                    for (let prods of cartVerifyData.productArr) {
                        await this.productService.updateProductStock(prods._id, prods.variant);
                    }
                }
                if (cartVerifyData.productOutOfStock && cartVerifyData.productOutOfStock.length) {
                    const productStockData = await Promise.all([
                        this.notificationService.createForProductOutOfStock(cartVerifyData.productOutOfStock),
                        this.productOutOfStockService.createProductStock(cartVerifyData.productOutOfStock),
                    ]);
                }
                const walletPayment = {
                    userId: userData._id,
                    orderId: orderRes._id,
                    orderID: orderRes.orderID,
                    amount: orderRes.usedWalletAmount
                };
                const notification = {
                    notifyType: notifications_model_1.NotificationType.ORDER_PLACED,
                    orderId: orderRes._id,
                    orderID: orderRes.orderID,
                };
                if (walletPayment.amount > 0)
                    await this.walletService.madeOrder(walletPayment);
                const placed = await Promise.all([
                    this.userService.updateWallet(userData._id, -orderRes.usedWalletAmount),
                    this.cartService.cartOrderUnlink(userCart._id),
                    this.notificationService.createForOrderPlaced(notification),
                ]);
                if (userData && userData.playerId) {
                    const title = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_PLACED_TITLE);
                    let desc = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_PLACED_DESC);
                    desc = desc.replace('${orderID}', orderRes.orderID);
                    this.pushService.sendNotificationToUser(userData.playerId, title, desc);
                }
                this.emailService.sendEmailForPlacedOrder(orderRes, userCart);
                this.socketService.sendOrderStatusNotificationToAdmin(notification);
                this.socketService.sendProductOutOfStocksNotificationToAdmin(cartVerifyData.productOutOfStock);
                return this.utilService.successResponseMsg(app_model_1.ResponseMessage.ORDER_PLACED);
            }
        }
        catch (e) {
            if (e && e.type && e.type === 'StripeInvalidRequestError')
                this.utilService.badRequest(e.raw.message);
            else
                this.utilService.errorResponse(e);
        }
    }
    async orderCancelledByUser(user, orderId) {
        this.utilService.validateUserRole(user);
        try {
            const order = await this.orderService.getOrderDetailForCancel(user._id, orderId);
            if (!order)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            if (order.orderStatus === order_model_1.OrderStatusType.DELIVERED)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_ALREADY_DELIVERED);
            let amountRefund = 0;
            if (order.paymentType === settings_model_1.PaymentMethod.COD && order.isWalletUsed && order.usedWalletAmount)
                amountRefund = order.usedWalletAmount;
            else if (order.paymentStatus === order_model_1.PaymentStatusType.SUCCESS && order.paymentType === settings_model_1.PaymentMethod.STRIPE)
                amountRefund = order.grandTotal + order.usedWalletAmount;
            await this.orderService.orderCancelByUser(user._id, orderId, amountRefund);
            const userCart = await this.cartService.getCartById(order.cartId);
            const products = await this.productService.getProductByIds(userCart.productIds);
            for (let prods of userCart.products) {
                const productIndex = await products.findIndex(val => val._id.toString() == prods.productId.toString());
                const varientIndex = await products[productIndex].variant.findIndex(val => val.unit == prods.unit);
                if (products[productIndex].variant[varientIndex].productStock === 0) {
                    await this.productOutOfStockService.deleteOutOfStock(products[productIndex]._id);
                }
                products[productIndex].variant[varientIndex].productStock += prods.quantity;
                await this.productService.updateProductStock(products[productIndex]._id, products[productIndex].variant[varientIndex]);
            }
            if (amountRefund !== 0) {
                let wallet = {
                    userId: user._id,
                    amount: amountRefund,
                    transactionType: wallet_model_1.WalletTransactionType.ORDER_CANCELLED,
                    orderId: order._id,
                    orderID: order.orderID
                };
                this.walletService.cancelOrder(wallet);
            }
            const notification = {
                notifyType: notifications_model_1.NotificationType.ORDER_CANCELLED,
                orderId: order._id,
                orderID: order.orderID,
            };
            const placed = await Promise.all([
                this.userService.updateWallet(user._id, amountRefund),
                this.notificationService.createForOrderCancel(notification)
            ]);
            let title = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_CANCELLED_TITLE);
            let desc = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_CANCELLED_DESC);
            desc = desc.replace('${orderID}', order.orderID);
            this.userService.descreaseOrderPurchased(user._id);
            this.pushService.sendNotificationToUser(user.playerId, title, desc);
            this.socketService.sendOrderStatusNotificationToAdmin(notification);
            return this.utilService.successResponseMsg(app_model_1.ResponseMessage.ORDER_CANCELLED);
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async assignedOrderListForDeliveryBoy(user, userQuery) {
        this.utilService.validateDeliveryBoyRole(user);
        try {
            let pagination = this.utilService.getUserPagination(userQuery);
            const orders = await Promise.all([
                this.orderService.getAllAssginedOrderForDeliveryBoy(user._id, pagination.page, pagination.limit),
                this.orderService.countAllAssginedOrderForDeliveryBoy(user._id)
            ]);
            return this.utilService.successResponseData(orders[0], { total: orders[1] });
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async deliveredOrderListForDeliveryBoy(user, userQuery) {
        this.utilService.validateDeliveryBoyRole(user);
        try {
            let pagination = this.utilService.getUserPagination(userQuery);
            const orders = await Promise.all([
                this.orderService.getAllDeliveredOrderForDeliveryBoy(user._id, pagination.page, pagination.limit),
                this.orderService.countAllDeliveredOrderForDeliveryBoy(user._id)
            ]);
            return this.utilService.successResponseData(orders[0], { total: orders[1] });
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async getOrderDetailForDeliveryBoy(user, orderId) {
        this.utilService.validateDeliveryBoyRole(user);
        try {
            let order = await this.orderService.getOrderDetailForBoy(user._id, orderId);
            if (!order)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            let cart = await this.cartService.getCartById(order.cartId);
            delete order.cartId;
            return this.utilService.successResponseData({ order: order, cart: cart });
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async orderAcceptByDeliveryBoy(user, orderId) {
        this.utilService.validateDeliveryBoyRole(user);
        try {
            const orderDetail = await this.orderService.getOrderDetail(orderId);
            if (!orderDetail)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            if (orderDetail.assignedToId != user._id)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            if (orderDetail.isAcceptedByDeliveryBoy)
                this.utilService.badRequest(app_model_1.ResponseMessage.DELIVERY_BOY_ALREADY_ACCEPTED_ORDER);
            const orderAccept = await this.orderService.orderAcceptByDelivery(orderId);
            if (orderAccept) {
                const notification = {
                    notifyType: notifications_model_1.NotificationType.ORDER_ACCEPTED_BY_DELIVERY_BOY,
                    orderId: orderDetail._id,
                    orderID: orderDetail.orderID,
                    deliveryBoyId: user._id,
                    deliveryBoyName: user.firstName + ' ' + user.lastName
                };
                this.socketService.sendOrderStatusNotificationToAdmin(notification);
                this.notificationService.createForAcceptedByBoy(notification);
                return this.utilService.successResponseMsg(app_model_1.ResponseMessage.ORDER_ACCEPTED_BY_DELIVERY_BOY);
            }
            else
                this.utilService.badRequest(app_model_1.ResponseMessage.SOMETHING_WENT_WRONG);
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async orderRejectedByDeliveryBoy(user, orderId) {
        this.utilService.validateDeliveryBoyRole(user);
        try {
            const orderDetail = await this.orderService.getOrderDetail(orderId);
            if (!orderDetail)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            if (orderDetail.assignedToId != user._id)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            if (orderDetail.isAcceptedByDeliveryBoy)
                this.utilService.badRequest(app_model_1.ResponseMessage.DELIVERY_BOY_ALREADY_ACCEPTED_ORDER);
            const orderRejected = await this.orderService.orderRejectedByDelivery(orderId, user._id, user.firstName);
            if (orderRejected) {
                const notification = {
                    notifyType: notifications_model_1.NotificationType.ORDER_REJECTED_BY_DELIVERY_BOY,
                    orderId: orderDetail._id,
                    orderID: orderDetail.orderID,
                    deliveryBoyId: user._id,
                    deliveryBoyName: user.firstName + ' ' + user.lastName
                };
                this.socketService.sendOrderStatusNotificationToAdmin(notification);
                this.notificationService.createForRejectedByBoy(notification);
                return this.utilService.successResponseMsg(app_model_1.ResponseMessage.ORDER_REJECTED_BY_DELIVERY_BOY);
            }
            this.utilService.badRequest(app_model_1.ResponseMessage.SOMETHING_WENT_WRONG);
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async orderStatusUpdateByDeliveryBoy(user, orderId, statusUpdate) {
        this.utilService.validateDeliveryBoyRole(user);
        try {
            const orderDetail = await this.orderService.getOrderDetail(orderId);
            if (!orderDetail)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            if (orderDetail.assignedToId != user._id)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            let orderStatusUpdate;
            console.log("status update", statusUpdate);
            if (statusUpdate.status === order_model_1.OrderStatusType.DELIVERED) {
                orderStatusUpdate = await this.orderService.orderStatusUpdateByDelivery(orderId, statusUpdate.status, order_model_1.PaymentStatusType.SUCCESS);
            }
            else {
                orderStatusUpdate = await this.orderService.orderStatusUpdateByDelivery(orderId, statusUpdate.status);
            }
            console.log("orderstatus updatae", orderStatusUpdate);
            if (orderStatusUpdate) {
                const userDetail = await this.userService.getUserById(orderDetail.userId);
                if (userDetail) {
                    let title = '', desc = '';
                    if (statusUpdate.status === order_model_1.OrderStatusType.OUT_FOR_DELIVERY) {
                        title = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_OUT_OF_DELIVERY_TITLE);
                        desc = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_OUT_OF_DELIVERY_DESC);
                        desc = desc.replace('${orderID}', orderDetail.orderID);
                    }
                    else if (statusUpdate.status === order_model_1.OrderStatusType.DELIVERED) {
                        title = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_DELIVERED_TITLE);
                        desc = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_DELIVERED_DESC);
                        desc = desc.replace('${orderID}', orderDetail.orderID);
                        const orders = await Promise.all([
                            this.cartService.getCartById(orderStatusUpdate.cartId),
                            this.businessService.getBusinessDetail()
                        ]);
                        this.userService.increaseOrderDelivered(user._id);
                        this.userService.increaseOrderPurchased(orderDetail.userId);
                        this.emailService.sendEmailOrderDelivered(orderDetail, orders[0], orders[1]);
                    }
                    if (userDetail && userDetail.playerId)
                        this.pushService.sendNotificationToUser(userDetail.playerId, title, desc);
                }
                let products = await this.cartService.getCartByIdOnlyProducts(orderDetail.cartId);
                products.productIds.map(async (c) => await this.cartService.addProductInOrdersForRating({ userId: userDetail._id, productId: c }));
                return this.utilService.successResponseMsg(app_model_1.ResponseMessage.ORDER_STATUS_UPDATED);
            }
            this.utilService.badRequest(app_model_1.ResponseMessage.SOMETHING_WENT_WRONG);
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async index(user, query) {
        this.utilService.validateAdminRole(user);
        try {
            const page = Number(query.page) || app_model_1.AdminSettings.DEFAULT_PAGE_NUMBER;
            const limit = Number(query.limit) || app_model_1.AdminSettings.DEFAULT_PAGE_LIMIT;
            let orderFilter = {};
            if (query.orderStatus)
                orderFilter["orderStatus"] = query.orderStatus;
            if (query.assignedToId)
                orderFilter["assignedToId"] = query.assignedToId;
            const orders = await Promise.all([
                this.orderService.getAllOrder(orderFilter, page - 1, limit),
                this.orderService.countAllOrder(orderFilter)
            ]);
            return this.utilService.successResponseData(orders[0], { total: orders[1] });
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async getOrderDetails(user, orderId) {
        this.utilService.validateAdminRole(user);
        try {
            const order = await this.orderService.getOrderDetail(orderId);
            if (!order)
                this.utilService.pageNotFound();
            let cart = await this.cartService.getCartById(order.cartId);
            let deliveryBoyRating = await this.deliveryBoyRatingsService.getDeliveryBoyRating(orderId);
            delete order.cartId;
            return this.utilService.successResponseData({ order: order, cart: cart, deliveryBoyRating: deliveryBoyRating });
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async updateOrderStatus(user, orderId, orderData) {
        this.utilService.validateAdminRole(user);
        try {
            const order = await this.orderService.getOrderDetail(orderId);
            if (!order)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            if (!(orderData.status == order_model_1.OrderStatusType.CONFIRMED || orderData.status == order_model_1.OrderStatusType.CANCELLED))
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_STATUS_INVALID);
            if (orderData.status == order_model_1.OrderStatusType.CONFIRMED) {
                await this.orderService.orderStatusUpdate(orderId, orderData.status);
            }
            else if (orderData.status == order_model_1.OrderStatusType.CANCELLED) {
                let amountRefund = order.grandTotal;
                if (order.paymentType === settings_model_1.PaymentMethod.COD && order.isWalletUsed && order.usedWalletAmount)
                    amountRefund = order.usedWalletAmount;
                else if (order.paymentType === settings_model_1.PaymentMethod.STRIPE)
                    amountRefund = order.grandTotal + order.usedWalletAmount;
                await this.orderService.orderCancelByAdmin(orderId, amountRefund);
                if (amountRefund !== 0) {
                    let wallet = {
                        userId: order.userId,
                        amount: amountRefund,
                        transactionType: wallet_model_1.WalletTransactionType.ORDER_CANCELLED,
                        orderId: order._id,
                        orderID: order.orderID
                    };
                    await Promise.all([
                        this.walletService.cancelOrder(wallet),
                        this.userService.updateWallet(order.userId, amountRefund)
                    ]);
                }
                const userCart = await this.cartService.getCartById(order.cartId);
                const products = await this.productService.getProductByIds(userCart.productIds);
                for (let prods of userCart.products) {
                    const productIndex = await products.findIndex(val => val._id.toString() == prods.productId.toString());
                    const varientIndex = await products[productIndex].variant.findIndex(val => val.unit == prods.unit);
                    if (products[productIndex].variant[varientIndex].productStock === 0) {
                        await this.productOutOfStockService.deleteOutOfStock(products[productIndex]._id);
                    }
                    products[productIndex].variant[varientIndex].productStock += prods.quantity;
                    await this.productService.updateProductStock(products[productIndex]._id, products[productIndex].variant[varientIndex]);
                }
                this.userService.descreaseOrderPurchased(order.userId);
            }
            const userDetail = await this.userService.getUserById(order.userId);
            if (userDetail && userDetail.playerId) {
                let title = '', desc = '';
                if (orderData.status === order_model_1.OrderStatusType.CONFIRMED) {
                    title = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_CONFIRMED_TITLE);
                    desc = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_CONFIRMED_DESC);
                    desc = desc.replace('${orderID}', order.orderID);
                }
                else if (orderData.status === order_model_1.OrderStatusType.CANCELLED) {
                    title = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_CANCELLED_TITLE);
                    desc = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.USER_NOTIFY_ORDER_CANCELLED_DESC);
                    desc = desc.replace('${orderID}', order.orderID);
                }
                this.pushService.sendNotificationToUser(userDetail.playerId, title, desc);
            }
            let products = await this.cartService.getCartByIdOnlyProducts(order.cartId);
            products.productIds.map(async (c) => await this.cartService.addProductInOrdersForRating({ userId: userDetail._id, productId: c }));
            return this.utilService.successResponseMsg(app_model_1.ResponseMessage.ORDER_UPDATED);
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async assignOrder(user, orderId, assignData) {
        this.utilService.validateAdminRole(user);
        try {
            const orderDetail = await this.orderService.getOrderDetail(orderId);
            if (!orderDetail)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_NOT_FOUND);
            if (orderDetail.isOrderAssigned)
                this.utilService.badRequest(app_model_1.ResponseMessage.ORDER_ALREADY_ASSIGNED);
            const boyDetail = await this.userService.getUserById(assignData.deliveryBoyId);
            if (!boyDetail)
                this.utilService.badRequest(app_model_1.ResponseMessage.DELIVERY_BOY_NOT_FOUND);
            const assignedToName = `${boyDetail.firstName} ${boyDetail.lastName}`;
            let assignOrderUpdate = { isOrderAssigned: true, isAcceptedByDeliveryBoy: false, assignedToId: boyDetail._id, assignedToName: assignedToName };
            await this.orderService.orderAssignToDelivery(orderId, assignOrderUpdate);
            if (boyDetail && boyDetail.playerId) {
                let title = '', desc = '';
                if (orderDetail.orderStatus === order_model_1.OrderStatusType.CONFIRMED) {
                    title = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.DELIVERY_BOY_NOTIFY_ORDER_ASSIGNED_TITLE);
                    desc = await this.utilService.getTranslatedMessageByKey(app_model_1.ResponseMessage.DELIVERY_BOY_NOTIFY_ORDER_ASSIGNED_DESC);
                    desc = desc.replace('${orderID}', orderDetail.orderID);
                    this.pushService.sendNotificationToDeliveryBoy(boyDetail.playerId, title, desc);
                }
            }
            let deliveryBoyNotification = {
                deliveryBoyId: boyDetail._id,
                orderId: orderDetail._id,
                orderID: orderDetail.orderID,
                user: orderDetail.user,
                address: orderDetail.address,
                deliveryDate: orderDetail.deliveryDate,
                deliveryTime: orderDetail.deliveryTime
            };
            this.socketService.newOrderForDeliveryBoy(deliveryBoyNotification);
            return this.utilService.successResponseMsg(app_model_1.ResponseMessage.ORDER_ASSIGNED_TO_DELIVERY_BOY);
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async getOrderStatusTypeList(user) {
        this.utilService.validateAdminRole(user);
        try {
            const orderStatusTypeList = await this.orderService.getOrderStatusTypeList();
            return this.utilService.successResponseData(orderStatusTypeList);
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async oderGraph(user) {
        this.utilService.validateAdminRole(user);
        try {
            const list = await Promise.all([
                this.orderService.getOrdersPriceInLast7Days(),
                this.orderService.getTotalOrderAmdSum(),
                this.productService.countAllProduct(),
                this.categoryService.countAllCategory(null)
            ]);
            let chartData = list[0];
            const labels = chartData.map(c => { return c._id.date + '-' + c._id.month + '-' + c._id.year; });
            const data = chartData.map(c => c.data);
            const result = {
                graph: { labels: labels, data: data },
                totalOrder: list[1].totalOrder,
                totalPrice: list[1].totalPrice,
                totalProduct: list[2],
                totalCategory: list[3]
            };
            return this.utilService.successResponseData(result);
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
    async invoiceDownload(user, res, orderId, token) {
        try {
            const order = await this.orderService.getOrderDetailByToken(orderId, token);
            if (!order)
                this.utilService.pageNotFound();
            const cartBusiness = await Promise.all([
                this.cartService.getCartById(order.cartId),
                this.businessService.getBusinessDetail()
            ]);
            let cart = cartBusiness[0];
            let business = cartBusiness[1];
            delete order.cartId;
            return res.sendFile(await this.emailService.createInvoice(order, cart, business));
        }
        catch (e) {
            this.utilService.errorResponse(e);
        }
    }
};
__decorate([
    common_1.Get('/list'),
    swagger_1.ApiOperation({ title: 'Get all order for user' }),
    swagger_1.ApiImplicitQuery({ name: "page", description: "page", required: false, type: Number }),
    swagger_1.ApiImplicitQuery({ name: "limit", description: "limit", required: false, type: Number }),
    swagger_1.ApiResponse({ status: 200, description: 'Return list of order for user', type: order_model_1.ResponseOrderDTOPagination }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, app_model_1.UserQuery]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "GetOrderListForUser", null);
__decorate([
    common_1.Get('/detail/:orderId'),
    swagger_1.ApiOperation({ title: 'Get order detail by orderId for user' }),
    swagger_1.ApiResponse({ status: 200, description: 'Success message', type: order_model_1.ResponseDataOfOrder }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Param('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getOrderDetailForUser", null);
__decorate([
    common_1.Post('/create'),
    swagger_1.ApiOperation({ title: 'Create order' }),
    swagger_1.ApiResponse({ status: 200, description: 'Success message', type: app_model_1.ResponseSuccessMessage }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, order_model_1.OrderCreateDTO]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "placeOrder", null);
__decorate([
    common_1.Put('/cancel/:orderId'),
    swagger_1.ApiOperation({ title: 'Cancel order' }),
    swagger_1.ApiResponse({ status: 200, description: 'Success message', type: app_model_1.ResponseSuccessMessage }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Param('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "orderCancelledByUser", null);
__decorate([
    common_1.Get('/delivery-boy/assigned/list'),
    swagger_1.ApiImplicitQuery({ name: "page", description: "page", required: false, type: Number }),
    swagger_1.ApiImplicitQuery({ name: "limit", description: "limit", required: false, type: Number }),
    swagger_1.ApiOperation({ title: 'Get all assigned order for delivery boy' }),
    swagger_1.ApiResponse({ status: 200, description: 'Return list of assigned order for delivery boy', type: order_model_1.ResponseDeiveryBoyPagination }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, app_model_1.UserQuery]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "assignedOrderListForDeliveryBoy", null);
__decorate([
    common_1.Get('/delivery-boy/delivered/list'),
    swagger_1.ApiOperation({ title: 'Get all delivered order for delivery boy' }),
    swagger_1.ApiImplicitQuery({ name: "page", description: "page", required: false, type: Number }),
    swagger_1.ApiImplicitQuery({ name: "limit", description: "limit", required: false, type: Number }),
    swagger_1.ApiResponse({ status: 200, description: 'Return list of delivered order for delivery boy', type: order_model_1.ResponseDeliveredOrderPagination }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, app_model_1.UserQuery]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "deliveredOrderListForDeliveryBoy", null);
__decorate([
    common_1.Get('/delivery-boy/detail/:orderId'),
    swagger_1.ApiOperation({ title: 'Get order detail by orderId for delivery boy' }),
    swagger_1.ApiResponse({ status: 200, description: 'Return order detail by orderId', type: order_model_1.ResponseDataOfOrder }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Param('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getOrderDetailForDeliveryBoy", null);
__decorate([
    common_1.Put('/delivery-boy/accept/:orderId'),
    swagger_1.ApiOperation({ title: 'Accept order by delivery boy' }),
    swagger_1.ApiResponse({ status: 200, description: 'Success message', type: app_model_1.ResponseSuccessMessage }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Param('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "orderAcceptByDeliveryBoy", null);
__decorate([
    common_1.Put('/delivery-boy/reject/:orderId'),
    swagger_1.ApiOperation({ title: 'Reject order by delivery boy' }),
    swagger_1.ApiResponse({ status: 200, description: 'Success message', type: app_model_1.ResponseSuccessMessage }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Param('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "orderRejectedByDeliveryBoy", null);
__decorate([
    common_1.Put('/delivery-boy/status-update/:orderId'),
    swagger_1.ApiOperation({ title: 'Update order status by delivery boy' }),
    swagger_1.ApiResponse({ status: 200, description: 'Success message', type: app_model_1.ResponseSuccessMessage }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Param('orderId')), __param(2, common_1.Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, String, order_model_1.DBStatusUpdateDTO]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "orderStatusUpdateByDeliveryBoy", null);
__decorate([
    common_1.Get('/admin/list'),
    swagger_1.ApiOperation({ title: 'Get all order' }),
    swagger_1.ApiImplicitQuery({ name: "orderStatus", description: "Get order details By Order status", required: false, type: String }),
    swagger_1.ApiImplicitQuery({ name: "assignedToId", description: "Get order details By Delivery-Boy Id", required: false, type: String }),
    swagger_1.ApiImplicitQuery({ name: "page", description: "page", required: false, type: Number }),
    swagger_1.ApiImplicitQuery({ name: "limit", description: "limit", required: false, type: Number }),
    swagger_1.ApiResponse({ status: 200, description: 'Return list of order ', type: order_model_1.ResponseOrderForAdmin }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, order_model_1.OrderFilterQuery]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "index", null);
__decorate([
    common_1.Get('/admin/detail/:orderId'),
    swagger_1.ApiOperation({ title: 'Get order detail by orderId' }),
    swagger_1.ApiResponse({ status: 200, description: 'Success message', type: order_model_1.ResponseAdminOrderDetailsOrderId }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Param('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getOrderDetails", null);
__decorate([
    common_1.Put('/admin/status-update/:orderId'),
    swagger_1.ApiOperation({ title: 'Update order status' }),
    swagger_1.ApiResponse({ status: 200, description: 'Success message', type: app_model_1.ResponseSuccessMessage }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Param('orderId')), __param(2, common_1.Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, String, order_model_1.OrderStatusDTO]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "updateOrderStatus", null);
__decorate([
    common_1.Put('/admin/assign/delivery-boy/:orderId'),
    swagger_1.ApiOperation({ title: 'Order assign to delivery boy' }),
    swagger_1.ApiResponse({ status: 200, description: 'Success message', type: app_model_1.ResponseSuccessMessage }),
    swagger_1.ApiResponse({ status: 400, description: 'Bad request message', type: app_model_1.ResponseBadRequestMessage }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Param('orderId')), __param(2, common_1.Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, String, order_model_1.AssignOrderDTO]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "assignOrder", null);
__decorate([
    common_1.Get('/admin/order-status-type/list'),
    swagger_1.ApiOperation({ title: 'Get all order status type for dropdown' }),
    swagger_1.ApiResponse({ status: 200, description: 'Return list of order status type', type: order_model_1.ResponseStatusList }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "getOrderStatusTypeList", null);
__decorate([
    common_1.Get('/admin/charts'),
    swagger_1.ApiOperation({ title: 'Get chart data for graph' }),
    swagger_1.ApiResponse({ status: 200, description: 'Return chart data', type: order_model_1.ResponseChardOrderDTO }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    common_1.UseGuards(passport_1.AuthGuard('jwt')),
    swagger_1.ApiBearerAuth(),
    __param(0, jwt_strategy_1.GetUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "oderGraph", null);
__decorate([
    common_1.Get('/admin/invoice/:orderId'),
    swagger_1.ApiOperation({ title: 'Get pdf invoice' }),
    swagger_1.ApiResponse({ status: 200, description: 'Return pdf invoice' }),
    swagger_1.ApiResponse({ status: 404, description: 'Unauthorized or Not found', type: app_model_1.ResponseErrorMessage }),
    __param(0, jwt_strategy_1.GetUser()), __param(1, common_1.Res()), __param(2, common_1.Param('orderId')), __param(3, common_1.Query('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [users_model_1.UsersDTO, Object, String, String]),
    __metadata("design:returntype", Promise)
], OrderController.prototype, "invoiceDownload", null);
OrderController = __decorate([
    common_1.Controller('orders'),
    swagger_1.ApiUseTags('Orders'),
    __metadata("design:paramtypes", [order_service_1.OrderService,
        util_service_1.UtilService,
        cart_service_1.CartService,
        wallet_service_1.WalletService,
        address_service_1.AddressService,
        settings_service_1.SettingService,
        products_service_1.ProductService,
        categories_service_1.CategoryService,
        sequence_service_1.SequenceService,
        users_service_1.UserService,
        notifications_service_1.NotificationService,
        push_service_1.PushService,
        stripe_service_1.StripeService,
        email_service_1.EmailService,
        app_gateway_1.AppGateway,
        business_service_1.BusinessService,
        product_out_of_stock_service_1.ProductOutOfStockService,
        delivery_boy_ratings_service_1.DeliveryBoyRatingsService])
], OrderController);
exports.OrderController = OrderController;
//# sourceMappingURL=order.controller.js.map