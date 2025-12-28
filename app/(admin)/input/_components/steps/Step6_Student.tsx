import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import FileDropzone from '../file-upload/FileDropzone';

export function Step6_Student({ data, onChange, errors }: { data: any; onChange: (field: string, value: any) => void; errors: { [key: string]: string } }) {
    return (
            <div className="flex flex-col gap-4 mt-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-black">Student</h3>
                        <p className="text-sm text-gray-400">Upload the student data file</p>
                    </div>
                    <a href="#" className="text-sm text-primary hover:underline flex items-center gap-2">
                        <FontAwesomeIcon icon={faDownload} />
                        example_student.csv
                    </a>
                </div>

                <FileDropzone
                    onFileSelect={(file) => console.log('File selected:', file)}
                    title="Upload Student Data"
                />
            </div>
    )
}