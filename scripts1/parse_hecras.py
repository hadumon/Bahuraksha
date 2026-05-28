import h5py
import json
import os

# Paths matching your setup
HDF_INPUT = "data/raw/sample_river.hdf"
JSON_OUTPUT = "data/raw/hecras_live.json"

def extract_hecras_data():
    if not os.path.exists(HDF_INPUT):
        print(f"Error: {HDF_INPUT} not found. Did you run the curl command?")
        return

    print(f"Opening real HEC-RAS file: {HDF_INPUT}...")
    
    with h5py.File(HDF_INPUT, 'r') as hdf:
        # Let's inspect the file's internal paths. 
        # HEC-RAS geometry datasets usually live inside 'Geometry/'
        if 'Geometry' in hdf:
            print("Found HEC-RAS Geometry group structure!")
            
            # Extract real River Centerline points (or structures, cross-sections)
            # Depending on if the file is 1D or 2D, data locations shift slightly.
            try:
                # Grabbing the raw array data out of the HDF structure
                centerline_path = 'Geometry/River Centerlines/Polyline Points'
                if centerline_path in hdf:
                    raw_points = hdf[centerline_path][:]
                    
                    # Convert the numpy array to a plain list for JSON compatibility
                    clean_points = raw_points.tolist()
                    
                    payload = {
                        "status": "live",
                        "data_type": "river_centerline_coordinates",
                        "total_nodes": len(clean_points),
                        "coordinates": clean_points[:100] # Grab first 100 points for the UI chart
                    }
                    
                    # Save it directly as your live file
                    with open(JSON_OUTPUT, "w") as f:
                        json.dump(payload, f, indent=4)
                        
                    print(f"Success! Cleaned data saved to {JSON_OUTPUT}")
                    return
                else:
                    # Fallback if it's a plan file with results instead of base geometry
                    print("This specific file contains alternative simulation summaries.")
                    
            except Exception as e:
                print(f"Could not parse nested data: {e}")
        else:
            print("Structure unexpected. Printing root layers to help you debug:")
            print(list(hdf.keys()))

if __name__ == "__main__":
    extract_hecras_data()