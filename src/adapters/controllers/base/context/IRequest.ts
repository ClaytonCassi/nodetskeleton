import { LocaleTypeEnum } from "../../../../application/shared/locals/LocaleType.enum";
import { ISession } from "../../../../domain/session/ISession";

export interface IRequest {
  isWhiteList: boolean;
  session: ISession;
  body: any;
  params: Record<string, string>;
  query: Record<string, string>;
  locale: LocaleTypeEnum;
}
