import container, { PongUseCase, NotFoundUseCase } from "./container/index";
import { IServiceContainer } from "../../shared/kernel";
import BaseController, {
  IRequest,
  IResponse,
  INextFunction,
  EntryPointHandler,
  IRouterType,
} from "../base/Base.controller";

export class HealthController extends BaseController {
  constructor(serviceContainer: IServiceContainer) {
    super(HealthController.name, serviceContainer);
  }

  pong: EntryPointHandler = async (
    req: IRequest,
    res: IResponse,
    next: INextFunction,
  ): Promise<void> => {
    return this.handleResultData(
      res,
      next,
      this.servicesContainer.get<PongUseCase>(this.CONTEXT, PongUseCase.name),
      req.locale,
    );
  };

  resourceNotFound: EntryPointHandler = async (
    req: IRequest,
    res: IResponse,
    next: INextFunction,
  ): Promise<void> => {
    return this.handleResult(
      res,
      next,
      this.servicesContainer.get<NotFoundUseCase>(this.CONTEXT, NotFoundUseCase.name),
      req.locale,
    );
  };

  initializeRoutes(router: IRouterType): void {
    this.router = router();
    this.router.get("/ping", this.pong);
  }
}

export default new HealthController(container);
