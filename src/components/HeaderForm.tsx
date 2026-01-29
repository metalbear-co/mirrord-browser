import {
    Input,
    Label,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from '@metalbear/ui';
import { STRINGS } from '../constants';

type HeaderFormProps = {
    headerName: string;
    headerValue: string;
    scope: string;
    onHeaderNameChange: (value: string) => void;
    onHeaderValueChange: (value: string) => void;
    onScopeChange: (value: string) => void;
};

export function HeaderForm({
    headerName,
    headerValue,
    scope,
    onHeaderNameChange,
    onHeaderValueChange,
    onScopeChange,
}: HeaderFormProps) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="headerName" className="text-xs">
                    {STRINGS.LABEL_HEADER_NAME}
                </Label>
                <Input
                    id="headerName"
                    value={headerName}
                    onChange={(e) => onHeaderNameChange(e.target.value)}
                    placeholder={STRINGS.PLACEHOLDER_HEADER_NAME}
                    className="h-8 text-xs"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="headerValue" className="text-xs">
                    {STRINGS.LABEL_HEADER_VALUE}
                </Label>
                <Input
                    id="headerValue"
                    value={headerValue}
                    onChange={(e) => onHeaderValueChange(e.target.value)}
                    placeholder={STRINGS.PLACEHOLDER_HEADER_VALUE}
                    className="h-8 text-xs"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                    <Label htmlFor="scope" className="text-xs">
                        {STRINGS.LABEL_URL_SCOPE}
                    </Label>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="text-muted-foreground cursor-help text-[10px]">
                                ⓘ
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs max-w-[200px]">
                            {STRINGS.TOOLTIP_SCOPE}
                        </TooltipContent>
                    </Tooltip>
                </div>
                <Input
                    id="scope"
                    value={scope}
                    onChange={(e) => onScopeChange(e.target.value)}
                    placeholder={STRINGS.PLACEHOLDER_SCOPE}
                    className="h-8 text-xs"
                />
            </div>
        </div>
    );
}
