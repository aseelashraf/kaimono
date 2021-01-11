import { UserCreateDTO, LoginDTO, LogInMobileDTO, UsersDTO, ChangePasswordDTO, ForgotPasswordDTO, ResetPasswordDTO, ResetNumberPasswordDTO, LanguageUpdateDTO, UsersUpdateDTO, UserStatusDTO, AdminDeliveryDTO, OTPVerifyDTO, OTPSendDTO, UserCreateMobileDTO } from './users.model';
import { UserService } from './users.service';
import { UtilService } from '../utils/util.service';
import { UploadImageDTO, CommonResponseModel, AdminQuery } from '../utils/app.model';
import { UploadService } from '../utils/upload.service';
import { AuthService } from '../utils/auth.service';
import { EmailService } from '../utils/email.service';
import { OtpService } from '../utils/otp.service';
export declare class UserController {
    private userService;
    private authService;
    private utilService;
    private emailService;
    private uploadService;
    private otpService;
    constructor(userService: UserService, authService: AuthService, utilService: UtilService, emailService: EmailService, uploadService: UploadService, otpService: OtpService);
    registerNewUser(userData: UserCreateDTO): Promise<CommonResponseModel>;
    validateUser(credential: LoginDTO): Promise<CommonResponseModel>;
    forgotPassword(emailData: ForgotPasswordDTO): Promise<CommonResponseModel>;
    resendVerifyUserEmail(email: string): Promise<{
        response_code: any;
        response_data: string;
    }>;
    verifyUserEmail(verificationId: string, email: string, res: any): Promise<any>;
    verifyOtpEmail(otp: string, email: string): Promise<{
        response_code: any;
        response_data: string;
    }>;
    resetPassword(passwordData: ResetPasswordDTO): Promise<CommonResponseModel>;
    changePassword(user: UsersDTO, passwordData: ChangePasswordDTO): Promise<CommonResponseModel>;
    GetUserInfo(user: UsersDTO): Promise<CommonResponseModel>;
    updateProfile(user: UsersDTO, userInfo: UsersUpdateDTO): Promise<CommonResponseModel>;
    logout(user: UsersDTO): Promise<CommonResponseModel>;
    getAllUserList(user: UsersDTO, adminQuery: AdminQuery): Promise<CommonResponseModel>;
    updateUserStatus(user: UsersDTO, userId: string, userStatusData: UserStatusDTO): Promise<CommonResponseModel>;
    createDeliveryBoy(user: UsersDTO, userData: AdminDeliveryDTO): Promise<CommonResponseModel>;
    getAllDeliveryBoy(user: UsersDTO, adminQuery: AdminQuery): Promise<CommonResponseModel>;
    updateDeliveryBoyStatus(user: UsersDTO, deliveryBoyId: string, userStatusData: UserStatusDTO): Promise<CommonResponseModel>;
    updateLanguage(user: UsersDTO, updateData: LanguageUpdateDTO): Promise<CommonResponseModel>;
    userImageUpload(user: UsersDTO, file: any, image: UploadImageDTO): Promise<CommonResponseModel>;
    deleteImage(user: UsersDTO): Promise<CommonResponseModel>;
    registerMobileNumber(userData: UserCreateMobileDTO): Promise<CommonResponseModel>;
    verifyOTPTwilio(otpData: OTPVerifyDTO): Promise<CommonResponseModel>;
    sendOTPTwilio(credentials: OTPSendDTO): Promise<CommonResponseModel>;
    loginPhone(credentials: LogInMobileDTO): Promise<CommonResponseModel>;
    resetPasswordNumber(passwordData: ResetNumberPasswordDTO): Promise<CommonResponseModel>;
    updateMobileVerify(user: UsersDTO, userInfo: OTPSendDTO): Promise<CommonResponseModel>;
    updateMobile(user: UsersDTO, otpData: OTPVerifyDTO): Promise<CommonResponseModel>;
}
