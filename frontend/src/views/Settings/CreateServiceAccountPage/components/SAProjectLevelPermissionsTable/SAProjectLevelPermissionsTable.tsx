import { useEffect, useState } from 'react';
import { Controller,useForm } from 'react-hook-form';
import {
    faKey,
    faMagnifyingGlass,
    faPlus,
    faTrash} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { 
    decryptAssymmetric,
    encryptAssymmetric,
    verifyPrivateKey} from '@app/components/utilities/cryptography/crypto';
import {
    Button,
    Checkbox,
    DeleteActionModal,
    EmptyState,
    FormControl,
    IconButton,
    Input,
    Modal,
    ModalClose,
    ModalContent,
    Select,
    SelectItem,
    Table,
    TableContainer,
    TableSkeleton,
    TBody,
    Td,
    Th,
    THead,
    Tr} from '@app/components/v2';
import { usePopUp } from '@app/hooks';
import {
    useCreateServiceAccountProjectLevelPermission,
    useDeleteServiceAccountProjectLevelPermission,
    useGetServiceAccountById,
    useGetServiceAccountProjectLevelPermissions,
    useGetUserWorkspaces} from '@app/hooks/api';
import getLatestFileKey from '@app/pages/api/workspace/getLatestFileKey';

const createProjectLevelPermissionSchema = yup.object({
    privateKey: yup.string().required().label('Private Key'),
    workspace: yup.string().required().label('Workspace'),
    environment: yup.string().required().label('Environment'),
    permissions: yup.object().shape({
        canRead: yup.boolean().required(),
        canWrite: yup.boolean().required(),
        canUpdate: yup.boolean().required(),
        canDelete: yup.boolean().required(),
    }).defined().required()
});

type CreateProjectLevelPermissionForm = yup.InferType<typeof createProjectLevelPermissionSchema>;

type Props = {
    serviceAccountId: string;
}

export const SAProjectLevelPermissionsTable = ({
    serviceAccountId
}: Props) => {
    const { data: serviceAccount } = useGetServiceAccountById(serviceAccountId);
    const { data: userWorkspaces, isLoading: isUserWorkspacesLoading } = useGetUserWorkspaces();
    const [searchPermissions, setSearchPermissions] = useState('');
    const [defaultValues, setDefaultValues] = useState<CreateProjectLevelPermissionForm | undefined>(undefined);

    const { data: serviceAccountWorkspacePermissions, isLoading: isPermissionsLoading } = useGetServiceAccountProjectLevelPermissions(serviceAccountId);
    
    const createServiceAccountProjectLevelPermission = useCreateServiceAccountProjectLevelPermission();
    const deleteServiceAccountProjectLevelPermission = useDeleteServiceAccountProjectLevelPermission();

    const { handlePopUpToggle, popUp, handlePopUpOpen, handlePopUpClose } = usePopUp([
        'addProjectLevelPermission',
        'removeProjectLevelPermission',
    ] as const);

    const {
        control,
        handleSubmit,
        reset,
        formState: { isSubmitting }
    } = useForm<CreateProjectLevelPermissionForm>({ resolver: yupResolver(createProjectLevelPermissionSchema), defaultValues })

    const onAddProjectLevelPermission = async ({
        privateKey,
        workspace,
        environment,
        permissions: { canRead, canWrite, canUpdate, canDelete }
    }: CreateProjectLevelPermissionForm) => {
        
        // TODO: clean up / modularize this function
        
        if (!serviceAccount) return;
        
        const { latestKey } = await getLatestFileKey({
            workspaceId: workspace
        });

        verifyPrivateKey({
            privateKey,
            publicKey: serviceAccount.publicKey
        });
        
        const PRIVATE_KEY = localStorage.getItem('PRIVATE_KEY') as string;

        const key = decryptAssymmetric({
            ciphertext: latestKey.encryptedKey,
            nonce: latestKey.nonce,
            publicKey: latestKey.sender.publicKey,
            privateKey: PRIVATE_KEY
        });
        
        const { ciphertext, nonce } = encryptAssymmetric({
            plaintext: key,
            publicKey: serviceAccount.publicKey,
            privateKey: PRIVATE_KEY
        });
        
        await createServiceAccountProjectLevelPermission.mutateAsync({
            serviceAccountId,
            workspaceId: workspace,
            environment,
            canRead,
            canWrite,
            canUpdate,
            canDelete,
            encryptedKey: ciphertext,
            nonce
        });
        handlePopUpClose('addProjectLevelPermission');
    }
    
    const onRemoveProjectLevelPermission = async () => {
        const serviceAccountWorkspacePermissionId = (popUp?.removeProjectLevelPermission?.data as { _id: string })?._id;
        await deleteServiceAccountProjectLevelPermission.mutateAsync({
           serviceAccountId,
           serviceAccountWorkspacePermissionId
        });
        handlePopUpClose('removeProjectLevelPermission');
    }

    useEffect(() => {
        if (userWorkspaces) {
            setDefaultValues({
                privateKey: '',
                workspace: String(userWorkspaces?.[0]?._id),
                environment: String(userWorkspaces?.[0]?.environments?.[0]?.slug),
                permissions: {
                    canRead: true,
                    canWrite: false,
                    canUpdate: false,
                    canDelete: false,
                }
            });
        }
    }, [userWorkspaces]);

    return (
        <div className="w-full bg-white/5 p-6">
            <p className="mb-4 text-xl font-semibold">Project-Level Permissions</p>
            <div className="mb-4 flex">
                <div className="mr-4 flex-1">
                    <Input 
                        value={searchPermissions}
                        onChange={(e) => setSearchPermissions(e.target.value)}
                        leftIcon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
                        placeholder="Search service account project-level permissions..."
                    />
                </div>
                <Button
                    leftIcon={<FontAwesomeIcon icon={faPlus} />}
                    onClick={() => {
                        handlePopUpOpen('addProjectLevelPermission')
                        reset();
                    }}
                >
                    Add Permission
                </Button>
            </div>
            <TableContainer>
                <Table>
                    <THead>
                        <Tr>
                            <Th>Project</Th>
                            <Th>Environment</Th>
                            <Th>Read</Th>
                            <Th>Write</Th>
                            <Th>Update</Th>
                            <Th>Delete</Th>
                            <Th aria-label="actions" />
                        </Tr>
                    </THead>
                    <TBody>
                        {isPermissionsLoading && <TableSkeleton columns={6} key="service-account-project-level-permissions" />}
                        {!isPermissionsLoading && serviceAccountWorkspacePermissions && (
                            serviceAccountWorkspacePermissions.map(({
                                _id,
                                workspace,
                                environment,
                                canRead,
                                canWrite,
                                canUpdate,
                                canDelete
                            }) => {
                                const environmentName = (workspace.environments.find((env) => env.slug === environment))?.name;
                                return (
                                    <Tr key={`service-account-project-level-permission-${_id}`} className="w-full">
                                        <Td>{workspace.name}</Td>
                                        <Td>{environmentName}</Td>
                                        <Td>
                                            <Checkbox
                                                id="isReadPermissionEnabled"
                                                isChecked={canRead}
                                                isDisabled
                                             />
                                        </Td>
                                        <Td>
                                            <Checkbox
                                                id="isWritePermissionEnabled"
                                                isChecked={canWrite}
                                                isDisabled
                                             />
                                        </Td>
                                        <Td>
                                            <Checkbox
                                                id="isUpdatePermissionEnabled"
                                                isChecked={canUpdate}
                                                isDisabled
                                             />
                                        </Td>
                                        <Td>
                                            <Checkbox
                                                id="isDeletePermissionEnabled"
                                                isChecked={canDelete}
                                                isDisabled
                                             />
                                        </Td>
                                        <Td>
                                            <IconButton
                                                ariaLabel="delete"
                                                colorSchema="danger"
                                                onClick={() => handlePopUpOpen('removeProjectLevelPermission', { _id })}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </IconButton>
                                        </Td>
                                    </Tr>
                                );
                            })
                        )}
                        {!isPermissionsLoading && serviceAccountWorkspacePermissions?.length === 0 && (
                            <Tr>
                                <Td colSpan={7} className="py-6 text-center text-bunker-400">
                                    <EmptyState title="No permissions found" icon={faKey} />
                                </Td>
                            </Tr>
                        )}
                    </TBody>
                </Table>
            </TableContainer>
            <Modal
                isOpen={popUp?.addProjectLevelPermission?.isOpen}
                onOpenChange={(isOpen) => {
                    handlePopUpToggle('addProjectLevelPermission', isOpen);
                }}
            >
                <ModalContent
                    title="Add a Project-Level Permission"
                    subTitle="The service account will be granted scoped access to the specified project and environment"
                >
                    <form onSubmit={handleSubmit(onAddProjectLevelPermission)}>
                        {!isUserWorkspacesLoading && userWorkspaces && (
                            <>
                                <Controller
                                    control={control}
                                    defaultValue=""
                                    name="privateKey"
                                    render={({ field, fieldState: { error } }) => (
                                        <FormControl
                                            label="Service Account Private Key"
                                            isError={Boolean(error)}
                                            errorText={error?.message}
                                        >
                                            <Input {...field} />
                                        </FormControl>
                                    )}
                                />
                                <Controller
                                    control={control}
                                    name="workspace"
                                    defaultValue={String(userWorkspaces?.[0]?._id)}
                                    render={({ field: { onChange, ...field }, fieldState: { error } }) => (
                                        <FormControl
                                            label="Project"
                                            errorText={error?.message}
                                        >
                                            <Select
                                                defaultValue={field.value}
                                                {...field}
                                                onValueChange={(e) => onChange(e)}
                                                className="w-full border border-mine-shaft-500"
                                            >
                                                {userWorkspaces && userWorkspaces.length > 0 ? (
                                                    userWorkspaces.map((userWorkspace) => {
                                                        return (
                                                            <SelectItem value={userWorkspace._id} key={`project-${userWorkspace._id}`}>
                                                                {userWorkspace.name}
                                                            </SelectItem>
                                                        );
                                                    })
                                                ) : (
                                                    <SelectItem value="none" key="target-app-none">
                                                        No projects found
                                                    </SelectItem>
                                                )}
                                            </Select>
                                        </FormControl>
                                    )}
                                />
                                <Controller
                                    control={control}
                                    name="environment"
                                    defaultValue={String(userWorkspaces?.[0]?.environments?.[0]?.slug)}
                                    render={({ field: { onChange, ...field } }) => {
                                        /* eslint-disable-next-line no-underscore-dangle */
                                        const environments = userWorkspaces?.find((userWorkspace) => userWorkspace._id === control?._formValues?.workspace)?.environments ?? [];
                                        return (
                                            <FormControl
                                                label="Environment"
                                                className="mt-4"
                                            >
                                                <Select
                                                    defaultValue={field.value}
                                                    {...field}
                                                    onValueChange={(e) => onChange(e)}
                                                    className="w-full border border-mine-shaft-500"
                                                >
                                                    {environments.length > 0 ? (
                                                        environments.map((environment) => {
                                                            return (
                                                                <SelectItem value={environment.slug} key={`environment-${environment.slug}`}>
                                                                    {environment.name}
                                                                </SelectItem>
                                                            );
                                                        })
                                                    ) : (
                                                        <SelectItem value="none" key="target-app-none">
                                                            No environments found
                                                        </SelectItem>
                                                    )}
                                                </Select>
                                            </FormControl>
                                        );
                                    }}
                                />
                            </>
                        )}
                        <Controller 
                            control={control}
                            name="permissions"
                            defaultValue={{
                                canRead: true,
                                canWrite: false,
                                canUpdate: false,
                                canDelete: false
                            }}
                            render={({ field: { onChange, value }, fieldState: { error }}) => { 
                                const options = [
                                    {
                                        label: 'Read (default)',
                                        value: 'canRead'
                                    }, 
                                    {
                                        label: 'Write',
                                        value: 'canWrite'
                                    },
                                    {
                                        label: 'Update',
                                        value: 'canUpdate'
                                    },
                                    {
                                        label: 'Delete',
                                        value: 'canDelete'
                                    }
                                ];
                                
                                return (
                                    <FormControl
                                        label="Permissions"
                                        errorText={error?.message}
                                        isError={Boolean(error)}
                                    >
                                        <>
                                            {options.map(({ label, value: optionValue }) => {
                                                return (
                                                    <Checkbox
                                                        id={value[optionValue]}
                                                        key={optionValue}
                                                        className="data-[state=checked]:bg-primary"
                                                        isChecked={value[optionValue]}
                                                        isDisabled={optionValue === 'read'}
                                                        onCheckedChange={(state) => {
                                                            onChange({
                                                                ...value,
                                                                [optionValue]: state
                                                            });
                                                        }}
                                                    >
                                                        {label}
                                                    </Checkbox>
                                                );
                                            })}
                                        </>
                                    </FormControl>
                                );
                            }}
                        />
                        <div className="mt-8 flex items-center">
                            <Button
                                className="mr-4"
                                type="submit"
                                isDisabled={isSubmitting}
                                isLoading={isSubmitting}
                            >
                                Create
                            </Button>
                            <ModalClose asChild>
                            <Button variant="plain" colorSchema="secondary">
                                Cancel
                            </Button>
                            </ModalClose>
                        </div>
                    </form>
                </ModalContent>
            </Modal>
            <DeleteActionModal
                isOpen={popUp.removeProjectLevelPermission.isOpen}
                deleteKey="remove"
                title="Do you want to remove this permission from the service account?"
                onChange={(isOpen) => handlePopUpToggle('removeProjectLevelPermission', isOpen)}
                onDeleteApproved={onRemoveProjectLevelPermission}
            />
        </div>
    );
}