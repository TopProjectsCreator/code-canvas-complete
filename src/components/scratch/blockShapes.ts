export type BlockShape = 'stack' | 'hat' | 'cap' | 'c-block' | 'reporter' | 'boolean';

export const getBlockShape = (opcode: string): BlockShape => {
  if (opcode.startsWith('event_when') || opcode === 'control_start_as_clone' || opcode === 'procedures_definition') return 'hat';
  if (opcode === 'control_stop' || opcode === 'control_delete_this_clone') return 'cap';
  if (['control_repeat', 'control_forever', 'control_if', 'control_if_else', 'control_repeat_until', 'control_wait_until', 'compat_foreverif'].includes(opcode)) return 'c-block';
  if (opcode === 'argument_reporter_boolean') return 'boolean';
  if (opcode === 'argument_reporter_string_number') return 'reporter';
  if (['sensing_answer', 'sensing_mousex', 'sensing_mousey', 'sensing_loudness', 'sensing_timer', 'sensing_dayssince2000', 'sensing_current',
    'sensing_username', 'sensing_of',
    'operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide', 'operator_random',
    'operator_join', 'operator_letter_of', 'operator_length', 'operator_mod', 'operator_round', 'operator_mathop',
    'data_variable', 'data_listcontents', 'data_itemoflist', 'data_itemnumoflist', 'data_lengthoflist', 'sensing_distanceto',
    'motion_xposition', 'motion_yposition', 'motion_direction',
    'looks_costumenumbername', 'looks_backdropnumbername', 'looks_size',
    'sound_volume',
  ].includes(opcode)) return 'reporter';
  if (['sensing_touchingobject', 'sensing_touchingcolor', 'sensing_coloristouchingcolor', 'sensing_keypressed', 'sensing_mousedown',
    'operator_gt', 'operator_lt', 'operator_equals', 'operator_and', 'operator_or', 'operator_not',
    'operator_contains', 'data_listcontainsitem',
  ].includes(opcode)) return 'boolean';
  return 'stack';
};
