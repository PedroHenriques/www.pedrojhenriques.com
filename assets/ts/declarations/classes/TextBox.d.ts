export declare class TextBox {
    private static div_work_area_;
    private static dom_style_tag_;
    private static textbox_elem_count;
    private static lang_;
    private static speeds_;
    static global_write_by_line_: boolean;
    static global_speed_: number | null;
    private static tag_keywords;
    private static self_closing_tags;
    private static re_str_tags_;
    private static regex_;
    private textbox_name;
    private textbox_elem;
    private file_content;
    private building_style;
    private style_text;
    private building_script;
    private script_text;
    private dump_style;
    private dump_script;
    private write_by_line;
    private speed;
    private forced_speed;
    private open_tags;
    private cur_str;
    private str_to_render;
    private advance_chars;
    private next_textbox;
    _expanded: boolean;
    constructor(file_name: string);
    static setLang_(lang: string): void;
    static setSpeeds_(speeds: {
        [key: string]: number;
    }): void;
    setSpeed(speeds_index: string): void;
    setForcedSpeed(speeds_index: string): void;
    expanded: boolean;
    run(): {
        textbox: string;
        delay: number;
    };
    private renderContent();
    private processTags();
    private processTextBlock(text);
    private dumpTextBlock();
    getFileContent(): Promise<string>;
    private determineSpeed();
    scrollToBottom(): void;
    private static addStyleTags_(text);
    private static addScriptTags_(text);
    private static createTextBoxElem_(elem_id);
}
