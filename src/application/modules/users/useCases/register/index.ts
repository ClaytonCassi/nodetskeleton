import { IWorkerProvider } from "../../../../shared/worker/providerContracts/IWorkerProvider";
import { TaskDictionaryEnum } from "../../../../shared/worker/models/TaskDictionary.enum";
import { BaseUseCase, IResult, Result } from "../../../../shared/useCase/BaseUseCase";
import { ILogProvider } from "../../../../shared/log/providerContracts/ILogProvider";
import { BooleanUtil } from "../../../../../domain/shared/utils/BooleanUtil";
import { PasswordBuilder } from "../../../../../domain/user/PasswordBuilder";
import { IUSerRepository } from "../../providerContracts/IUser.repository";
import { LocaleTypeEnum } from "../../../../shared/locals/LocaleType.enum";
import { WorkerTask } from "../../../../shared/worker/models/WorkerTask";
import DateTimeUtils from "../../../../shared/utils/DateTimeUtil";
import AppSettings from "../../../../shared/settings/AppSettings";
import GuidUtil from "../../../../shared/utils/GuidUtil";
import { IUser } from "../../../../../domain/user/IUser";
import { Email } from "../../../../../domain/user/Email";
import { Throw } from "../../../../shared/errors/Throw";
import { IUserDto, UserDto } from "../../dtos/User.dto";
import { User } from "../../../../../domain/user/User";

export class RegisterUserUseCase extends BaseUseCase<IUserDto> {
  constructor(
    readonly logProvider: ILogProvider,
    private readonly userRepository: IUSerRepository,
    private readonly workerProvider: IWorkerProvider,
  ) {
    super(RegisterUserUseCase.name, logProvider);
  }

  async execute(locale: LocaleTypeEnum, args: IUserDto): Promise<IResult> {
    this.setLocale(locale);
    const result = new Result();

    const userDto = UserDto.fromJSON(args);
    if (!userDto.isValid(result, this.appWords, this.validator)) return result;

    const user = await this.buildUser(userDto);

    this.validateEmail(user.email);

    this.validatePassword(userDto.getCredentialsDto().passwordBuilder as PasswordBuilder);

    const userExists = await this.userExists(result, user.email?.value as string);
    if (userExists) return result;

    const userRegistered = await this.registerUser(result, user);
    if (!userRegistered) return result;

    result.setMessage(
      this.appMessages.get(this.appMessages.keys.USER_WAS_CREATED),
      this.applicationStatus.SUCCESS,
    );

    return result;
  }

  private validateEmail(email: Email | undefined): void {
    Throw.when(
      this.CONTEXT,
      !email?.isValid(),
      this.appMessages.get(this.appMessages.keys.INVALID_EMAIL),
      this.applicationStatus.INVALID_INPUT,
    );
  }

  private validatePassword(passwordBuilder: PasswordBuilder): void {
    Throw.when(
      this.CONTEXT,
      !passwordBuilder.isValid(),
      this.appMessages.get(this.appMessages.keys.INVALID_PASSWORD),
      this.applicationStatus.INVALID_INPUT,
    );
  }

  private async userExists(result: IResult, email: string): Promise<boolean> {
    const userExists = await this.userRepository.getByEmail(email);
    if (userExists) {
      result.setError(
        this.appMessages.getWithParams(this.appMessages.keys.USER_WITH_EMAIL_ALREADY_EXISTS, {
          email,
        }),
        this.applicationStatus.INVALID_INPUT,
      );
      return BooleanUtil.YES;
    }

    return BooleanUtil.NO;
  }

  private async buildUser(userDto: UserDto): Promise<User> {
    const maskedUid = GuidUtil.getV4WithoutDashes();
    const createdAt = DateTimeUtils.getISONow();
    const buildedUser = userDto.toDomain(undefined, maskedUid, createdAt, BooleanUtil.NOT_VERIFIED);
    buildedUser.password = await this.encryptPassword(
      userDto.getCredentialsDto().passwordBuilder as PasswordBuilder,
    );

    return buildedUser;
  }

  private async encryptPassword(passwordBuilder: PasswordBuilder): Promise<string> {
    const task: WorkerTask = new WorkerTask(TaskDictionaryEnum.ENCRYPT_PASSWORD);
    const workerArgs = {
      text: passwordBuilder.value,
      encryptionKey: AppSettings.EncryptionKey,
      iterations: AppSettings.EncryptionIterations,
    };
    task.setArgs(workerArgs);
    const workerResult = await this.workerProvider.executeTask<string>(task);

    return Promise.resolve(workerResult);
  }

  private async registerUser(result: IResult, user: IUser): Promise<boolean> {
    const registeredUser = await this.userRepository.register(user);

    if (!registeredUser) {
      result.setError(
        this.appMessages.get(this.appMessages.keys.ERROR_CREATING_USER),
        this.applicationStatus.INTERNAL_ERROR,
      );
      return BooleanUtil.FAILED;
    }

    return BooleanUtil.SUCCESS;
  }
}
