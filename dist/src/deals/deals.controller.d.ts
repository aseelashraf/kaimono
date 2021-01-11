import { DealService } from './deals.service';
import { UsersDTO } from '../users/users.model';
import { DealStatusDTO, DealSaveDTO } from './deals.model';
import { UtilService } from '../utils/util.service';
import { UploadService } from '../utils/upload.service';
import { CategoryService } from '../categories/categories.service';
import { ProductService } from '../products/products.service';
import { UploadImageDTO, CommonResponseModel, AdminQuery } from '../utils/app.model';
export declare class DealController {
    private dealService;
    private categoryService;
    private productService;
    private utilService;
    private uploadService;
    constructor(dealService: DealService, categoryService: CategoryService, productService: ProductService, utilService: UtilService, uploadService: UploadService);
    topDeal(): Promise<CommonResponseModel>;
    dealOfTheDay(): Promise<CommonResponseModel>;
    getDeals(user: UsersDTO, adminQuery: AdminQuery): Promise<CommonResponseModel>;
    getDealInformation(user: UsersDTO, dealId: string): Promise<CommonResponseModel>;
    createDeal(user: UsersDTO, dealData: DealSaveDTO): Promise<CommonResponseModel>;
    updateDeal(user: UsersDTO, dealId: string, dealData: DealSaveDTO): Promise<CommonResponseModel>;
    updateDealStatus(user: UsersDTO, dealId: string, dealStatusData: DealStatusDTO): Promise<CommonResponseModel>;
    deleteDeal(user: UsersDTO, dealId: string): Promise<CommonResponseModel>;
    dealImageUpload(user: UsersDTO, file: any, image: UploadImageDTO): Promise<CommonResponseModel>;
    getDealTypeList(user: UsersDTO): Promise<CommonResponseModel>;
}
