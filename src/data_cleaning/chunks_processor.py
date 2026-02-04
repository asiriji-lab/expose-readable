# import pandas as pd
# from typing import Dict, Any, List, Generator

# # --- Configuration ---
# CHUNK_SIZE = 75 

# # Helper Function: Chunk DataFrame ---
# def chunk_dataframe(df: pd.DataFrame, chunk_size: int = CHUNK_SIZE) -> Generator[pd.DataFrame, None, None]:
#     num_chunks = (len(df) + chunk_size - 1) // chunk_size
#     for i in range(num_chunks):
#         start = i * chunk_size
#         end = min((i + 1) * chunk_size, len(df))
#         yield df.iloc[start:end]

# # Helper Function: Format DF to Markdown ---
# def format_df_to_markdown(df: pd.DataFrame) -> str:
#     df_copy = df.copy()
#     # Convert complex list/dict objects (like teacher IDs, room options) to readable strings
#     for col in df_copy.columns:
#         if df_copy[col].apply(lambda x: isinstance(x, (list, dict, set))).any():
#             # Convert lists/dicts to a standard string representation
#             df_copy[col] = df_copy[col].apply(
#                 lambda x: str(x).replace("'", "").replace('"', '').replace(' ', '')
#             )
#     return df_copy.to_markdown(index=False)

# # Main Function: Create Chunks for entry data
# def create_preschedule_input_chunks(processed_dfs: Dict[str, pd.DataFrame]) -> List[str]:
#     # Define a logical order for sending constraint data
#     # True means data is large/critical and should be chunked if > CHUNK_SIZE
#     sheet_processing_order = {
#         'curriculum': True,
#         'elective': True,
#         'teacher': True,
#         'period': False,
#         'preplace': False,
#         'room': True,
#         'student': False,
#         'scout': False,
#     }
    
#     # Collect all data segments for later sequencing
#     data_segments = []
    
#     # Process each sheet
#     for sheet_name, needs_chunking in sheet_processing_order.items():
#         if sheet_name in processed_dfs:
#             df = processed_dfs[sheet_name]
            
#             # Decide whether to chunk or send as one block
#             if needs_chunking and len(df) > CHUNK_SIZE:
#                 # Chunk the large dataframes
#                 for i, chunk_df in enumerate(chunk_dataframe(df, CHUNK_SIZE)):
#                     segment_header = f"### {sheet_name.upper()} DATA (PART {i+1} OF {sheet_name.upper()})"
#                     data_segments.append(
#                         f"{segment_header}\n"
#                         f"{format_df_to_markdown(chunk_df)}"
#                     )
#             else:
#                 # Send small dataframes as one block
#                 segment_header = f"### {sheet_name.upper()} DATA"
#                 data_segments.append(
#                     f"{segment_header}\n"
#                     f"{format_df_to_markdown(df)}"
#                 )


#     main_chunks = []
#     total_data_segments = len(data_segments)
#     total_parts = total_data_segments + 2
    
#     # the initial prompt, input definitions
#     system_prompt_file_path = "scheduling_prompt/Agent1/system_prompt.txt"
#     system_prompt = ""
#     try:
#         with open(system_prompt_file_path, 'r', encoding='utf-8') as f:
#             system_prompt = f.read()
#         print(f"✅ Successfully read prompt input definition from: {system_prompt_file_path}")
#     except FileNotFoundError:
#         print(f"❌ ERROR: Prompt file not found at path: {system_prompt_file_path}. Cannot proceed.")
#         return []
#     except Exception as e:
#         print(f"❌ ERROR reading file: {e}")
#         return []
    
#     if not system_prompt.strip():
#         print("⚠️ Warning: Input definition prompt file is empty.")
    
#     main_chunks.append(f"PART 1 of {total_parts}\n---\n{system_prompt}")
    
#     # Add the data segments
#     for i, segment in enumerate(data_segments, start=2):
#         main_chunks.append(f"\nPART {i} of {total_parts}\n---\n{segment}")
        
#     # Add the Final Instruction/Execution Call (The last part)
#     operation_prompt_file_path = "scheduling_prompt/Agent1/operation_prompt.txt"
#     operation_prompt = ""
#     try:
#         with open(operation_prompt_file_path, 'r', encoding='utf-8') as f:
#             operation_prompt = f.read()
#         print(f"✅ Successfully read prompt input definition from: {operation_prompt_file_path}")
#     except FileNotFoundError:
#         print(f"❌ ERROR: Prompt file not found at path: {operation_prompt_file_path}. Cannot proceed.")
#         return []
#     except Exception as e:
#         print(f"❌ ERROR reading file: {e}")
#         return []
#     main_chunks.append(operation_prompt)
    
#     return main_chunks