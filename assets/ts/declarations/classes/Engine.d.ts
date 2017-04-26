export declare class Engine {
    static is_paused_: boolean;
    private static div_work_area_;
    private timeout_id;
    private lang;
    private file_list;
    private text_box_objs;
    private expanded_text_boxes;
    private active_box;
    private promises;
    private active_speed_level;
    pending_speed_level: number | null;
    constructor(lang: string, file_list: string[], start_index: number, built_on_server: boolean);
    run(): void;
    private setDefaultSpeeds();
    scrollBoxesToBottom(names?: string[]): void;
    setTextboxState(name: string, expanded: boolean): void;
    private static blockMouseEvents_(turn_on);
    private finalTasks();
    pauseProgram(): void;
    resumeProgram(): void;
    private changeSpeed(speed_level);
}
